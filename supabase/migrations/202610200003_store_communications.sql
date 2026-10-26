begin;

-- Claim an automation state transition in one transaction so overlapping
-- Vercel cron runs or webhook retries cannot send duplicate messages.
create or replace function public.claim_store_document_field(
  p_path text,
  p_field text,
  p_value jsonb,
  p_blocked_statuses text[] default '{}'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  if p_path is null or p_path !~ '^[A-Za-z0-9_/-]+$'
     or p_field is null or p_field !~ '^[A-Za-z][A-Za-z0-9_]*$'
     or jsonb_typeof(p_value) is distinct from 'object'
     or p_blocked_statuses is null then
    raise exception using errcode = '22023', message = 'Invalid document state claim.';
  end if;

  update public.store_documents
     set payload = jsonb_set(payload, array[p_field], p_value, true),
         updated_at = now()
   where path = p_path
     and not (
       coalesce(payload -> p_field ->> 'status', payload ->> p_field, '')
       = any(p_blocked_statuses)
     )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_store_document_field(text, text, jsonb, text[]) from public;
revoke all on function public.claim_store_document_field(text, text, jsonb, text[]) from anon, authenticated;
grant execute on function public.claim_store_document_field(text, text, jsonb, text[]) to service_role;

create or replace function public.cancel_store_order(p_order_id text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.store_documents%rowtype;
  order_data jsonb;
  product_row public.store_documents%rowtype;
  product_data jsonb;
  product_id text;
  product_units integer;
  variant_matrix jsonb;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,80}$' or p_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid cancellation request.';
  end if;

  select * into order_row
    from public.store_documents
   where path = 'orders/' || p_order_id
     and collection_path = 'orders'
   for update;
  if not found then
    raise exception using errcode = '42501', message = 'This order is not available to your account.';
  end if;
  if order_row.payload ->> 'userId' is distinct from p_user_id::text then
    raise exception using errcode = '42501', message = 'This order is not available to your account.';
  end if;

  order_data := order_row.payload;
  if order_data ->> 'status' = 'Cancelled' then
    return true;
  end if;
  if order_data ->> 'status' is distinct from 'Pending' then
    raise exception using errcode = 'P0001', message = 'Only pending orders can be cancelled.';
  end if;

  for product_id, product_units in
    select item -> 'product' ->> 'id', sum((item ->> 'quantity')::integer)::integer
      from jsonb_array_elements(coalesce(order_data -> 'items', '[]'::jsonb)) as line(item)
     where coalesce(item -> 'product' ->> 'id', '') ~ '^[0-9]{1,18}$'
       and coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$'
     group by item -> 'product' ->> 'id'
  loop
    select * into product_row
      from public.store_documents
     where path = 'products/' || product_id
       and collection_path = 'products'
     for update;
    if not found then
      continue;
    end if;

    product_data := product_row.payload;
    if jsonb_typeof(product_data -> 'variantMatrix') = 'array' then
      select coalesce(
        jsonb_agg(
          case
            when variant_units.units > 0 then
              jsonb_set(
                variant_units.variant,
                '{stock}',
                to_jsonb(greatest(
                  0,
                  coalesce((variant_units.variant ->> 'stock')::integer, 0)
                  + variant_units.units
                )),
                true
              )
            else variant_units.variant
          end
          order by variant_units.ordinality
        ),
        '[]'::jsonb
      )
      into variant_matrix
      from (
        select variant,
               ordinality,
               coalesce((
                 select sum((item ->> 'quantity')::integer)::integer
                   from jsonb_array_elements(coalesce(order_data -> 'items', '[]'::jsonb)) as line(item)
                  where item -> 'product' ->> 'id' = product_id
                    and coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$'
                    and (
                      (nullif(item ->> 'variantId', '') is not null
                        and item ->> 'variantId' = variant ->> 'id')
                      or (nullif(item ->> 'variantId', '') is null
                        and item ->> 'variant' = variant ->> 'label')
                    )
               ), 0) as units
          from jsonb_array_elements(product_data -> 'variantMatrix')
            with ordinality as variants(variant, ordinality)
      ) as variant_units;
      product_data := jsonb_set(product_data, '{variantMatrix}', variant_matrix, true);
    end if;

    product_data := jsonb_set(
      product_data,
      '{stock}',
      to_jsonb(greatest(0, coalesce((product_data ->> 'stock')::integer, 0) + product_units)),
      true
    );
    product_data := jsonb_set(product_data, '{inStock}', 'true'::jsonb, true);
    update public.store_documents
       set payload = product_data, updated_at = now()
     where path = 'products/' || product_id;
  end loop;

  order_data := jsonb_set(order_data, '{status}', '"Cancelled"'::jsonb, true);
  order_data := jsonb_set(order_data, '{cancelledAt}', to_jsonb(now()::text), true);
  update public.store_documents
     set payload = order_data, updated_at = now()
   where path = order_row.path;
  return true;
end;
$$;

revoke all on function public.cancel_store_order(text, uuid) from public;
revoke all on function public.cancel_store_order(text, uuid) from anon, authenticated;
grant execute on function public.cancel_store_order(text, uuid) to service_role;

-- Reopening a cancelled order is the inverse of cancellation: it reserves stock
-- again under row locks and refuses to restore fulfillment when inventory ran out.
create or replace function public.reopen_store_order(
  p_order_id text,
  p_user_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.store_documents%rowtype;
  order_data jsonb;
  item jsonb;
  product_row public.store_documents%rowtype;
  product_data jsonb;
  product_id text;
  variant_matrix jsonb;
  variant_data jsonb;
  quantity integer;
  stock integer;
  variant_id text;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,80}$'
     or p_user_id is null
     or p_status is null
     or p_status not in ('Pending', 'Processing', 'Confirmed by Call', 'Shipped', 'Out for Delivery', 'Delivered') then
    raise exception using errcode = '22023', message = 'Invalid order reopening request.';
  end if;

  select * into order_row
    from public.store_documents
   where path = 'orders/' || p_order_id
     and collection_path = 'orders'
   for update;
  if not found or order_row.payload ->> 'userId' is distinct from p_user_id::text then
    raise exception using errcode = '42501', message = 'This order is not available to the administrator.';
  end if;
  order_data := order_row.payload;
  if order_data ->> 'status' is distinct from 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'Only cancelled orders can be reopened.';
  end if;
  if jsonb_typeof(order_data -> 'items') is distinct from 'array'
     or jsonb_array_length(order_data -> 'items') < 1 then
    raise exception using errcode = '22023', message = 'This cancelled order has no recoverable inventory lines.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(order_data -> 'items', '[]'::jsonb)) loop
    product_id := coalesce(item ->> 'productId', item -> 'product' ->> 'id', '');
    quantity := case when coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$' then (item ->> 'quantity')::integer else 0 end;
    if product_id !~ '^[0-9]{1,18}$' or quantity < 1 or quantity > 99 then
      raise exception using errcode = '22023', message = 'The cancelled order contains invalid inventory details.';
    end if;
    select * into product_row
      from public.store_documents
     where path = 'products/' || product_id
       and collection_path = 'products'
     for update;
    if not found or coalesce(product_row.payload ->> 'status', 'active') <> 'active' then
      raise exception using errcode = 'P0001', message = 'A product from this order is no longer available.';
    end if;

    product_data := product_row.payload;
    variant_matrix := case when jsonb_typeof(product_data -> 'variantMatrix') = 'array' then product_data -> 'variantMatrix' else '[]'::jsonb end;
    variant_id := nullif(item ->> 'variantId', '');
    if jsonb_array_length(variant_matrix) > 0 then
      select value into variant_data
        from jsonb_array_elements(variant_matrix)
       where value ->> 'id' = variant_id
          or (variant_id is null and value ->> 'label' = item ->> 'variant')
       limit 1;
      if variant_data is null then
        raise exception using errcode = 'P0001', message = 'A product option from this order is no longer available.';
      end if;
      stock := case when coalesce(variant_data ->> 'stock', '') ~ '^[0-9]+$' then (variant_data ->> 'stock')::integer else 0 end;
      if stock < quantity then
        raise exception using errcode = 'P0001', message = 'There is not enough stock to reopen this order.';
      end if;
      stock := stock - quantity;
      select coalesce(jsonb_agg(
        case when value ->> 'id' = variant_data ->> 'id'
          then jsonb_set(value, '{stock}', to_jsonb(stock), true)
          else value
        end
      ), '[]'::jsonb) into variant_matrix
        from jsonb_array_elements(variant_matrix);
      product_data := jsonb_set(product_data, '{variantMatrix}', variant_matrix, true);
      stock := greatest(0, coalesce((product_data ->> 'stock')::integer, 0) - quantity);
    else
      stock := case when coalesce(product_data ->> 'stock', '') ~ '^[0-9]+$' then (product_data ->> 'stock')::integer else 0 end;
      if stock < quantity then
        raise exception using errcode = 'P0001', message = 'There is not enough stock to reopen this order.';
      end if;
      stock := stock - quantity;
    end if;
    product_data := jsonb_set(product_data, '{stock}', to_jsonb(stock), true);
    product_data := jsonb_set(product_data, '{inStock}', to_jsonb(stock > 0), true);
    update public.store_documents
       set payload = product_data, updated_at = now()
     where path = 'products/' || product_id;
  end loop;

  order_data := (order_data - 'cancelledAt')
    || jsonb_build_object('status', p_status, 'reopenedAt', now());
  update public.store_documents
     set payload = order_data, updated_at = now()
   where path = order_row.path;
  return true;
end;
$$;

revoke all on function public.reopen_store_order(text, uuid, text) from public;
revoke all on function public.reopen_store_order(text, uuid, text) from anon, authenticated;
grant execute on function public.reopen_store_order(text, uuid, text) to service_role;

-- Validate and consume the one-time voice callback nonce, then apply the
-- customer's response atomically. Cancelling restores product and variant
-- inventory in the same transaction as the order transition.
create or replace function public.process_voice_call_response(
  p_order_id text,
  p_nonce_hash text,
  p_digit text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.store_documents%rowtype;
  order_data jsonb;
  voice_data jsonb;
  product_row public.store_documents%rowtype;
  product_data jsonb;
  product_id text;
  product_units integer;
  variant_matrix jsonb;
  final_status text;
  voice_status text;
  outcome_message text;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,80}$'
     or p_nonce_hash is null or p_nonce_hash !~ '^[a-f0-9]{64}$'
     or p_digit not in ('1', '2') then
    return 'invalid';
  end if;

  select * into order_row
    from public.store_documents
   where path = 'orders/' || p_order_id
     and collection_path = 'orders'
   for update;

  if not found then
    return 'invalid';
  end if;

  order_data := order_row.payload;
  voice_data := coalesce(order_data -> 'voiceCall', '{}'::jsonb);
  if voice_data ->> 'nonceHash' <> p_nonce_hash
     or voice_data ->> 'status' <> 'dispatched'
     or order_data ->> 'status' is distinct from 'Pending'
     or order_data ->> 'paymentMethod' is distinct from 'COD' then
    return 'invalid';
  end if;

  if p_digit = '2' then
    for product_id, product_units in
      select item -> 'product' ->> 'id', sum((item ->> 'quantity')::integer)::integer
        from jsonb_array_elements(coalesce(order_data -> 'items', '[]'::jsonb)) as line(item)
       where coalesce(item -> 'product' ->> 'id', '') ~ '^[0-9]{1,18}$'
         and coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$'
       group by item -> 'product' ->> 'id'
    loop
      select * into product_row
        from public.store_documents
       where path = 'products/' || product_id
         and collection_path = 'products'
       for update;

      if not found then
        continue;
      end if;

      product_data := product_row.payload;
      if jsonb_typeof(product_data -> 'variantMatrix') = 'array' then
        select coalesce(
          jsonb_agg(
            case
              when variant_units.units > 0 then
                jsonb_set(
                  variant_units.variant,
                  '{stock}',
                  to_jsonb(greatest(
                    0,
                    coalesce((variant_units.variant ->> 'stock')::integer, 0)
                    + variant_units.units
                  )),
                  true
                )
              else variant_units.variant
            end
            order by variant_units.ordinality
          ),
          '[]'::jsonb
        )
        into variant_matrix
        from (
          select variant,
                 ordinality,
                 coalesce((
                   select sum((item ->> 'quantity')::integer)::integer
                     from jsonb_array_elements(coalesce(order_data -> 'items', '[]'::jsonb)) as line(item)
                    where item -> 'product' ->> 'id' = product_id
                      and coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$'
                      and (
                        (nullif(item ->> 'variantId', '') is not null
                          and item ->> 'variantId' = variant ->> 'id')
                        or (nullif(item ->> 'variantId', '') is null
                          and item ->> 'variant' = variant ->> 'label')
                      )
                 ), 0) as units
            from jsonb_array_elements(product_data -> 'variantMatrix')
              with ordinality as variants(variant, ordinality)
        ) as variant_units;

        product_data := jsonb_set(product_data, '{variantMatrix}', variant_matrix, true);
      end if;

      product_data := jsonb_set(
        product_data,
        '{stock}',
        to_jsonb(greatest(0, coalesce((product_data ->> 'stock')::integer, 0) + product_units)),
        true
      );
      product_data := jsonb_set(product_data, '{inStock}', 'true'::jsonb, true);
      update public.store_documents
         set payload = product_data, updated_at = now()
       where path = 'products/' || product_id;
    end loop;
    final_status := 'Cancelled';
    voice_status := 'cancelled';
    outcome_message := 'Customer cancelled by pressing 2.';
  else
    final_status := 'Confirmed by Call';
    voice_status := 'confirmed';
    outcome_message := 'Customer confirmed by pressing 1.';
  end if;

  voice_data := jsonb_set(voice_data, '{status}', to_jsonb(voice_status), true);
  voice_data := jsonb_set(voice_data, '{nonceHash}', 'null'::jsonb, true);
  voice_data := jsonb_set(voice_data, '{updatedAt}', to_jsonb(now()::text), true);
  voice_data := jsonb_set(
    voice_data,
    '{events}',
    coalesce(voice_data -> 'events', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'status', voice_status,
        'message', outcome_message,
        'createdAt', now()
      )),
    true
  );
  order_data := jsonb_set(order_data, '{status}', to_jsonb(final_status), true);
  order_data := jsonb_set(order_data, '{voiceCall}', voice_data, true);

  update public.store_documents
     set payload = order_data, updated_at = now()
   where path = order_row.path;

  return lower(voice_status);
end;
$$;

revoke all on function public.process_voice_call_response(text, text, text) from public;
revoke all on function public.process_voice_call_response(text, text, text) from anon, authenticated;
grant execute on function public.process_voice_call_response(text, text, text) to service_role;

commit;

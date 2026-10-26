begin;

-- Compatibility storage for the storefront's evolving settings and admin
-- documents. Stable commerce entities remain represented by the normalized
-- tables created by the base storefront schema migration.
create table if not exists public.store_documents (
  path text primary key,
  collection_path text not null,
  document_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists store_documents_collection_path_idx
  on public.store_documents(collection_path);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'store_documents'
     ) then
    alter publication supabase_realtime add table public.store_documents;
  end if;
end;
$$;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_allowlist allowlist
    where allowlist.user_id = auth.uid()
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when public.profiles.display_name = '' then excluded.display_name
          else public.profiles.display_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.store_documents enable row level security;

-- Public storefront reads are limited to published catalog content. All
-- management access is tied to the administrator allowlist.
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (true);
drop policy if exists categories_admin_manage on public.categories;
create policy categories_admin_manage on public.categories
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (status = 'active');
drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage on public.products
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists deals_public_read on public.deals;
create policy deals_public_read on public.deals
  for select to anon, authenticated using (active);
drop policy if exists deals_admin_manage on public.deals;
create policy deals_admin_manage on public.deals
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists coupons_public_read on public.coupons;
create policy coupons_public_read on public.coupons
  for select to anon, authenticated
  using (active and (expires_at is null or expires_at >= current_date));
drop policy if exists coupons_admin_manage on public.coupons;
create policy coupons_admin_manage on public.coupons
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (published);
drop policy if exists reviews_admin_manage on public.reviews;
create policy reviews_admin_manage on public.reviews
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists store_config_public_read on public.store_config;
create policy store_config_public_read on public.store_config
  for select to anon, authenticated using (id = 'global');
drop policy if exists store_config_admin_manage on public.store_config;
create policy store_config_admin_manage on public.store_config
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_store_admin());
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_store_admin())
  with check (
    public.is_store_admin()
    or (id = auth.uid() and admin = false)
  );
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and admin = false);

drop policy if exists admin_allowlist_read_self_or_admin on public.admin_allowlist;
create policy admin_allowlist_read_self_or_admin on public.admin_allowlist
  for select to authenticated
  using (user_id = auth.uid() or public.is_store_admin());
drop policy if exists admin_allowlist_admin_manage on public.admin_allowlist;
create policy admin_allowlist_admin_manage on public.admin_allowlist
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists storefront_state_owner_manage on public.storefront_state;
create policy storefront_state_owner_manage on public.storefront_state
  for all to authenticated
  using (profile_id = auth.uid() or public.is_store_admin())
  with check (profile_id = auth.uid() or public.is_store_admin());

drop policy if exists orders_read_owner_or_admin on public.orders;
create policy orders_read_owner_or_admin on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_store_admin());
drop policy if exists orders_admin_manage on public.orders;
create policy orders_admin_manage on public.orders
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists order_items_read_owner_or_admin on public.order_items;
create policy order_items_read_owner_or_admin on public.order_items
  for select to authenticated
  using (
    public.is_store_admin()
    or exists (
      select 1
      from public.orders customer_order
      where customer_order.id = order_items.order_id
        and customer_order.user_id = auth.uid()
    )
  );
drop policy if exists order_items_admin_manage on public.order_items;
create policy order_items_admin_manage on public.order_items
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists checkout_sessions_owner_or_admin on public.checkout_sessions;
create policy checkout_sessions_owner_or_admin on public.checkout_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_store_admin())
  with check (user_id = auth.uid() or public.is_store_admin());

drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets
  for select to anon, authenticated using (true);
drop policy if exists media_assets_admin_manage on public.media_assets;
create policy media_assets_admin_manage on public.media_assets
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

-- Administrative records remain private; server-side mail and messaging
-- endpoints use the service role and never expose provider credentials.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_access_state',
    'admin_audit_log',
    'inbox',
    'email_settings',
    'voice_settings',
    'email_campaign_drafts',
    'email_campaigns',
    'email_logs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_manage', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin())',
      table_name || '_admin_manage',
      table_name
    );
  end loop;
end;
$$;

grant select on public.products, public.categories, public.deals, public.coupons,
  public.reviews, public.store_config, public.media_assets to anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (
  display_name,
  phone,
  address_line1,
  address_line2,
  city,
  province,
  postal_code,
  birthday,
  marketing_consent,
  updated_at
) on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.admin_allowlist to authenticated;
grant select, insert, update, delete on public.admin_allowlist to authenticated;
grant select, insert, update, delete on public.storefront_state,
  public.checkout_sessions to authenticated;
grant select, insert, update, delete on public.admin_access_state,
  public.admin_audit_log, public.inbox, public.email_settings, public.voice_settings,
  public.email_campaign_drafts, public.email_campaigns, public.email_logs to authenticated;

drop policy if exists store_documents_read_public on public.store_documents;
create policy store_documents_read_public
  on public.store_documents
  for select
  to anon, authenticated
  using (
    collection_path in ('products', 'categories')
    or (collection_path = 'reviews' and payload ->> 'published' = 'true')
    or (path = 'storeContent/global')
  );

drop policy if exists store_documents_read_owner on public.store_documents;
create policy store_documents_read_owner
  on public.store_documents
  for select
  to authenticated
  using (
    path = 'users/' || auth.uid()::text
    or path like 'users/' || auth.uid()::text || '/%'
    or (
      collection_path = 'adminAccess/allowlist/users'
      and document_id = auth.uid()::text
    )
  );

drop policy if exists store_documents_read_admin on public.store_documents;
create policy store_documents_read_admin
  on public.store_documents
  for select
  to authenticated
  using (public.is_store_admin());

drop policy if exists store_documents_read_orders on public.store_documents;
create policy store_documents_read_orders
  on public.store_documents
  for select
  to authenticated
  using (
    collection_path = 'orders'
    and (
      payload ->> 'userId' = auth.uid()::text
      or public.is_store_admin()
    )
  );

drop policy if exists store_documents_write_admin on public.store_documents;
create policy store_documents_write_admin
  on public.store_documents
  for all
  to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists store_documents_write_owner on public.store_documents;
create policy store_documents_write_owner
  on public.store_documents
  for all
  to authenticated
  using (
    path = 'users/' || auth.uid()::text
    or path like 'users/' || auth.uid()::text || '/%'
  )
  with check (
    (path = 'users/' || auth.uid()::text
      or path like 'users/' || auth.uid()::text || '/%')
    and (
      public.is_store_admin()
      or path <> 'users/' || auth.uid()::text
      or coalesce(payload ->> 'admin', 'false') <> 'true'
    )
  );

grant select, insert, update, delete on public.store_documents to anon, authenticated;

-- Batch writes execute in one PostgreSQL transaction. RLS remains enabled
-- because this function uses the caller's privileges (SECURITY INVOKER).
create or replace function public.apply_store_documents_batch(p_operations jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  operation jsonb;
  document_path text;
  path_separator integer;
  document_collection text;
  document_id_value text;
  operation_kind text;
  document_payload jsonb;
begin
  if jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception 'Invalid store document batch.';
  end if;
  if jsonb_array_length(p_operations) > 500 then
    raise exception 'Invalid store document batch.';
  end if;

  for operation in select value from jsonb_array_elements(p_operations)
  loop
    document_path := operation ->> 'path';
    operation_kind := operation ->> 'type';
    if document_path is null or document_path !~ '^[A-Za-z0-9_/-]+$' then
      raise exception 'Invalid store document path.';
    end if;

    path_separator := length(document_path) - strpos(reverse(document_path), '/');
    if path_separator < 1 then
      raise exception 'A document path must include a collection and an ID.';
    end if;
    document_collection := left(document_path, path_separator);
    document_id_value := substr(document_path, path_separator + 2);

    if operation_kind = 'delete' then
      delete from public.store_documents where path = document_path;
    elsif operation_kind in ('set', 'update') then
      document_payload := operation -> 'data';
      if jsonb_typeof(document_payload) is distinct from 'object' then
        raise exception 'Document data must be a JSON object.';
      end if;
      insert into public.store_documents(path, collection_path, document_id, payload)
      values (document_path, document_collection, document_id_value, document_payload)
      on conflict (path) do update
        set collection_path = excluded.collection_path,
            document_id = excluded.document_id,
            payload = case
              when operation_kind = 'update' or operation ->> 'merge' = 'true'
                then public.store_documents.payload || excluded.payload
              else excluded.payload
            end,
            updated_at = now();
    else
      raise exception 'Unsupported store document operation.';
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_store_documents_batch(jsonb) from public;
grant execute on function public.apply_store_documents_batch(jsonb) to authenticated;
grant execute on function public.apply_store_documents_batch(jsonb) to service_role;

create or replace function public.consume_store_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_key is null or length(p_key) < 8 or length(p_key) > 200
     or p_max_requests < 1 or p_window_seconds < 1 then
    raise exception using errcode = '22023', message = 'Invalid rate limit request.';
  end if;
  insert into public.rate_limits(key, window_started_at, request_count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (key) do update
    set window_started_at = case
          when public.rate_limits.window_started_at is null
            or public.rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now()
          else public.rate_limits.window_started_at
        end,
        request_count = case
          when public.rate_limits.window_started_at is null
            or public.rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1
          else public.rate_limits.request_count + 1
        end,
        updated_at = now()
  returning request_count into updated_count;
  return updated_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_store_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_store_rate_limit(text, integer, integer) to service_role;

create unique index if not exists store_documents_checkout_request_unique
  on public.store_documents ((payload ->> 'userId'), (payload ->> 'requestId'))
  where collection_path = 'orders'
    and coalesce(payload ->> 'requestId', '') <> '';

create or replace function public.place_store_order(p_user_id uuid, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id text;
  order_id text;
  order_data jsonb;
  item jsonb;
  item_product jsonb;
  stored_product jsonb;
  product_row public.store_documents%rowtype;
  variant_row jsonb;
  variant_matrix jsonb;
  variant_quantity integer;
  quantity integer;
  stock integer;
  current_price numeric;
  snapshot_price numeric;
  product_id text;
  line_variant_id text;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '28000', message = 'A valid signed-in customer is required.';
  end if;
  if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_order -> 'items') <> 'array'
     or jsonb_array_length(p_order -> 'items') < 1 or jsonb_array_length(p_order -> 'items') > 50 then
    raise exception using errcode = '22023', message = 'An order must contain between one and fifty cart lines.';
  end if;

  request_id := coalesce(p_order ->> 'requestId', '');
  if request_id !~ '^[A-Za-z0-9-]{8,80}$' then
    raise exception using errcode = '22023', message = 'A valid checkout request identifier is required.';
  end if;
  select payload into order_data
  from public.store_documents
  where collection_path = 'orders'
    and payload ->> 'userId' = p_user_id::text
    and payload ->> 'requestId' = request_id
  limit 1;
  if order_data is not null then
    return order_data || jsonb_build_object('_created', false);
  end if;

  for item in select value from jsonb_array_elements(p_order -> 'items') loop
    product_id := coalesce(item ->> 'productId', '');
    if product_id !~ '^[0-9]{1,18}$' then
      raise exception using errcode = '22023', message = 'A cart line contains an invalid product identifier.';
    end if;
    quantity := case when coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$' then (item ->> 'quantity')::integer else 0 end;
    if quantity < 1 or quantity > 99 then
      raise exception using errcode = '22023', message = 'Cart quantities must be whole numbers from one to ninety-nine.';
    end if;
    select * into product_row
      from public.store_documents
      where path = 'products/' || product_id
        and collection_path = 'products'
      for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'A product in this cart is no longer available.';
    end if;
    select payload into order_data
      from public.store_documents
      where collection_path = 'orders'
        and payload ->> 'userId' = p_user_id::text
        and payload ->> 'requestId' = request_id
      limit 1;
    if order_data is not null then
      return order_data || jsonb_build_object('_created', false);
    end if;
    stored_product := product_row.payload;
    variant_matrix := case when jsonb_typeof(stored_product -> 'variantMatrix') = 'array' then stored_product -> 'variantMatrix' else '[]'::jsonb end;
    if coalesce(stored_product ->> 'status', 'active') <> 'active'
       or (
         jsonb_array_length(variant_matrix) = 0
         and coalesce((stored_product ->> 'inStock')::boolean, true) is false
       ) then
      raise exception using errcode = 'P0001', message = 'A product in this cart is no longer available.';
    end if;

    line_variant_id := nullif(item ->> 'variantId', '');
    if jsonb_array_length(variant_matrix) > 0 then
      select value into variant_row
        from jsonb_array_elements(variant_matrix)
        where value ->> 'id' = line_variant_id
           or (line_variant_id is null and value ->> 'label' = item ->> 'variant')
        limit 1;
      if variant_row is null then
        raise exception using errcode = 'P0001', message = 'A selected product option is no longer available.';
      end if;
      stock := case when coalesce(variant_row ->> 'stock', '') ~ '^[0-9]+$' then (variant_row ->> 'stock')::integer else 0 end;
      current_price := case when coalesce(variant_row ->> 'price', '') ~ '^[0-9]+([.][0-9]+)?$' then (variant_row ->> 'price')::numeric else 0 end;
      if stock < quantity then
        raise exception using errcode = 'P0001', message = 'There is not enough stock for a selected product option.';
      end if;
    else
      stock := case when coalesce(stored_product ->> 'stock', '') ~ '^[0-9]+$' then (stored_product ->> 'stock')::integer else 0 end;
      current_price := case when coalesce(stored_product ->> 'price', '') ~ '^[0-9]+([.][0-9]+)?$' then (stored_product ->> 'price')::numeric else 0 end;
      if stock < quantity then
        raise exception using errcode = 'P0001', message = 'There is not enough stock for a product in this cart.';
      end if;
    end if;

    item_product := item -> 'product';
    snapshot_price := case when coalesce(item_product ->> 'price', '') ~ '^[0-9]+([.][0-9]+)?$' then (item_product ->> 'price')::numeric else -1 end;
    if snapshot_price <> current_price then
      raise exception using errcode = 'P0001', message = 'A product price changed. Refresh your cart before placing the order.';
    end if;
  end loop;

  select payload into order_data
  from public.store_documents
  where collection_path = 'orders'
    and payload ->> 'userId' = p_user_id::text
    and payload ->> 'requestId' = request_id
  limit 1;
  if order_data is not null then
    return order_data || jsonb_build_object('_created', false);
  end if;

  -- Inventory changes and the order document are committed atomically. Any failed
  -- line raises an exception and rolls back all earlier stock updates.
  for item in select value from jsonb_array_elements(p_order -> 'items') loop
    product_id := item ->> 'productId';
    quantity := (item ->> 'quantity')::integer;
    line_variant_id := nullif(item ->> 'variantId', '');
    select * into product_row
      from public.store_documents
      where path = 'products/' || product_id and collection_path = 'products'
      for update;
    stored_product := product_row.payload;
    variant_matrix := case when jsonb_typeof(stored_product -> 'variantMatrix') = 'array' then stored_product -> 'variantMatrix' else '[]'::jsonb end;
    if jsonb_array_length(variant_matrix) > 0 then
      select value into variant_row
        from jsonb_array_elements(variant_matrix)
        where value ->> 'id' = line_variant_id
           or (line_variant_id is null and value ->> 'label' = item ->> 'variant')
        limit 1;
      variant_quantity := (variant_row ->> 'stock')::integer - quantity;
      select jsonb_agg(
        case when value ->> 'id' = variant_row ->> 'id'
          then jsonb_set(value, '{stock}', to_jsonb(variant_quantity), true)
          else value
        end
      ) into variant_matrix
      from jsonb_array_elements(variant_matrix);
      stored_product := jsonb_set(stored_product, '{variantMatrix}', coalesce(variant_matrix, '[]'::jsonb), true);
      stock := greatest(0, (stored_product ->> 'stock')::integer - quantity);
      stored_product := jsonb_set(stored_product, '{stock}', to_jsonb(stock), true);
      stored_product := jsonb_set(stored_product, '{inStock}', to_jsonb(stock > 0), true);
    else
      stock := (stored_product ->> 'stock')::integer - quantity;
      stored_product := jsonb_set(stored_product, '{stock}', to_jsonb(stock), true);
      stored_product := jsonb_set(stored_product, '{inStock}', to_jsonb(stock > 0), true);
    end if;
    update public.store_documents
      set payload = stored_product, updated_at = now()
      where path = 'products/' || product_id;
  end loop;

  order_id := 'ORD-' || upper(substr(md5(p_user_id::text || ':' || request_id), 1, 16));
  order_data := p_order || jsonb_build_object(
    'id', order_id,
    'userId', p_user_id::text,
    'requestId', request_id,
    'createdAt', now(),
    'status', 'Pending'
  );
  insert into public.store_documents(path, collection_path, document_id, payload)
    values ('orders/' || order_id, 'orders', order_id, order_data);
  return order_data || jsonb_build_object('_created', true);
end;
$$;

revoke all on function public.place_store_order(uuid, jsonb) from public;
grant execute on function public.place_store_order(uuid, jsonb) to service_role;

create or replace function public.sync_store_document_to_normalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  row_path text;
  row_id text;
  category_id_value text;
  numeric_id bigint;
begin
  if tg_op = 'DELETE' then
    row_data := old.payload;
    row_path := old.path;
    row_id := old.document_id;
  else
    row_data := new.payload;
    row_path := new.path;
    row_id := new.document_id;
  end if;

  if tg_op = 'DELETE' then
    if old.collection_path = 'products' and row_id ~ '^[0-9]+$' then
      delete from public.products where id = row_id::bigint;
    elsif old.collection_path = 'categories' then
      delete from public.categories where id = row_id;
    elsif old.collection_path = 'reviews' then
      delete from public.reviews where id = row_id;
    elsif old.collection_path = 'deals' then
      delete from public.deals where id = row_id;
    elsif old.collection_path = 'coupons' then
      delete from public.coupons where id = row_id;
    elsif old.collection_path = 'mediaAssets' then
      delete from public.media_assets where id = row_id;
    elsif old.collection_path = 'inbox' then
      delete from public.inbox where id = row_id;
    elsif old.collection_path = 'checkoutSessions' then
      delete from public.checkout_sessions
        where user_id = case when row_id ~* '^[0-9a-f-]{36}$' then row_id::uuid else null end;
    elsif old.collection_path = 'orders' then
      delete from public.orders where id = row_id;
    elsif old.path = 'storeContent/global' then
      delete from public.store_config where id = 'global';
    end if;
    return old;
  end if;

  if new.collection_path = 'products' and row_id ~ '^[0-9]+$' then
    numeric_id := row_id::bigint;
    category_id_value := coalesce(row_data ->> 'categoryId', row_data ->> 'category_id');
    if category_id_value is not null
       and not exists (select 1 from public.categories where id = category_id_value) then
      category_id_value := null;
    end if;
    insert into public.products (
      id, name, category_id, category_label, brand, status, price, old_price,
      badge, image, images, shade, from_price, variants, variation_types,
      variant_matrix, features, additional_info, description, usage,
      shipping_info, in_stock, stock, rating, review_count,
      free_delivery_eligible, cash_on_delivery_enabled, quantity_discounts,
      seo, updated_at, extra
    ) values (
      numeric_id,
      coalesce(row_data ->> 'name', ''),
      category_id_value,
      coalesce(row_data ->> 'category', row_data ->> 'categoryLabel', ''),
      nullif(row_data ->> 'brand', ''),
      case when row_data ->> 'status' in ('active', 'draft', 'archived') then row_data ->> 'status' else 'active' end,
      case when coalesce(row_data ->> 'price', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'price')::numeric else 0 end,
      case when coalesce(row_data ->> 'oldPrice', row_data ->> 'old_price', '') ~ '^[0-9]+([.][0-9]+)?$' then coalesce(row_data ->> 'oldPrice', row_data ->> 'old_price')::numeric else null end,
      nullif(row_data ->> 'badge', ''),
      coalesce(row_data ->> 'image', ''),
      case when jsonb_typeof(row_data -> 'images') = 'array' then row_data -> 'images' else '[]'::jsonb end,
      coalesce(row_data ->> 'shade', ''),
      coalesce((row_data ->> 'fromPrice')::boolean, false),
      case when jsonb_typeof(row_data -> 'variants') = 'array' then row_data -> 'variants' else '[]'::jsonb end,
      case when jsonb_typeof(row_data -> 'variationTypes') = 'array' then row_data -> 'variationTypes' else '[]'::jsonb end,
      case when jsonb_typeof(row_data -> 'variantMatrix') = 'array' then row_data -> 'variantMatrix' else '[]'::jsonb end,
      case when jsonb_typeof(row_data -> 'features') = 'array' then row_data -> 'features' else '[]'::jsonb end,
      row_data ->> 'additionalInfo',
      row_data ->> 'description',
      row_data ->> 'usage',
      row_data ->> 'shippingInfo',
      coalesce((row_data ->> 'inStock')::boolean, true),
      case when coalesce(row_data ->> 'stock', '') ~ '^-?[0-9]+$' then greatest((row_data ->> 'stock')::integer, 0) else 0 end,
      case when coalesce(row_data ->> 'rating', '') ~ '^[0-5]([.][0-9]+)?$' then (row_data ->> 'rating')::numeric else null end,
      case when coalesce(row_data ->> 'reviewCount', '') ~ '^[0-9]+$' then (row_data ->> 'reviewCount')::integer else 0 end,
      coalesce((row_data ->> 'freeDeliveryEligible')::boolean, false),
      coalesce((row_data ->> 'cashOnDeliveryEnabled')::boolean, false),
      case when jsonb_typeof(row_data -> 'quantityDiscounts') = 'object' then row_data -> 'quantityDiscounts' else null end,
      case when jsonb_typeof(row_data -> 'seo') = 'object' then row_data -> 'seo' else '{}'::jsonb end,
      now(),
      row_data
    )
    on conflict (id) do update set
      name = excluded.name, category_id = excluded.category_id,
      category_label = excluded.category_label, brand = excluded.brand,
      status = excluded.status, price = excluded.price, old_price = excluded.old_price,
      badge = excluded.badge, image = excluded.image, images = excluded.images,
      shade = excluded.shade, from_price = excluded.from_price,
      variants = excluded.variants, variation_types = excluded.variation_types,
      variant_matrix = excluded.variant_matrix, features = excluded.features,
      additional_info = excluded.additional_info, description = excluded.description,
      usage = excluded.usage, shipping_info = excluded.shipping_info,
      in_stock = excluded.in_stock, stock = excluded.stock, rating = excluded.rating,
      review_count = excluded.review_count,
      free_delivery_eligible = excluded.free_delivery_eligible,
      cash_on_delivery_enabled = excluded.cash_on_delivery_enabled,
      quantity_discounts = excluded.quantity_discounts, seo = excluded.seo,
      updated_at = now(), extra = excluded.extra;
  elsif new.collection_path = 'categories' then
    insert into public.categories(id, name, image, sub, color, seo, extra)
    values (
      row_id,
      coalesce(row_data ->> 'name', row_id),
      coalesce(row_data ->> 'image', ''),
      coalesce(row_data ->> 'sub', ''),
      coalesce(row_data ->> 'color', ''),
      case when jsonb_typeof(row_data -> 'seo') = 'object' then row_data -> 'seo' else '{}'::jsonb end,
      row_data
    )
    on conflict (id) do update set
      name = excluded.name, image = excluded.image, sub = excluded.sub,
      color = excluded.color, seo = excluded.seo, extra = excluded.extra;
  elsif new.collection_path = 'reviews' then
    insert into public.reviews(id, customer, city, body, rating, published, video_url, thumbnail_url, avatar_url, extra)
    values (
      row_id,
      coalesce(row_data ->> 'customer', row_data ->> 'name', ''),
      coalesce(row_data ->> 'city', ''),
      coalesce(row_data ->> 'body', row_data ->> 'text', ''),
      case when coalesce(row_data ->> 'rating', '') ~ '^[0-5]([.][0-9]+)?$' then (row_data ->> 'rating')::numeric else 5 end,
      coalesce((row_data ->> 'published')::boolean, false),
      coalesce(row_data ->> 'videoUrl', ''),
      coalesce(row_data ->> 'thumbnailUrl', ''),
      nullif(row_data ->> 'avatarUrl', ''),
      row_data
    )
    on conflict (id) do update set
      customer = excluded.customer, city = excluded.city, body = excluded.body,
      rating = excluded.rating, published = excluded.published,
      video_url = excluded.video_url, thumbnail_url = excluded.thumbnail_url,
      avatar_url = excluded.avatar_url, extra = excluded.extra;
  elsif new.collection_path = 'deals' then
    insert into public.deals(id, name, buy_x, get_y, product_ids, active, extra)
    values (
      row_id,
      coalesce(row_data ->> 'name', ''),
      case when coalesce(row_data ->> 'buyX', '') ~ '^[0-9]+$' then greatest((row_data ->> 'buyX')::integer, 1) else 1 end,
      case when coalesce(row_data ->> 'getY', '') ~ '^[0-9]+$' then greatest((row_data ->> 'getY')::integer, 1) else 1 end,
      case when jsonb_typeof(row_data -> 'productIds') = 'array' then
        array(select value::bigint from jsonb_array_elements_text(row_data -> 'productIds') as item(value) where value ~ '^[0-9]+$')
        else '{}'::bigint[] end,
      coalesce((row_data ->> 'active')::boolean, false),
      row_data
    )
    on conflict (id) do update set
      name = excluded.name, buy_x = excluded.buy_x, get_y = excluded.get_y,
      product_ids = excluded.product_ids, active = excluded.active, extra = excluded.extra;
  elsif new.collection_path = 'coupons' then
    insert into public.coupons(id, code, percent_off, minimum_subtotal, active, expires_at, extra)
    values (
      row_id,
      coalesce(row_data ->> 'code', ''),
      case when coalesce(row_data ->> 'percentOff', '') ~ '^[0-9]+([.][0-9]+)?$' then least((row_data ->> 'percentOff')::numeric, 100) else 0 end,
      case when coalesce(row_data ->> 'minimumSubtotal', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'minimumSubtotal')::numeric else 0 end,
      coalesce((row_data ->> 'active')::boolean, false),
      case when coalesce(row_data ->> 'expiresAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (row_data ->> 'expiresAt')::date else null end,
      row_data
    )
    on conflict (id) do update set
      code = excluded.code, percent_off = excluded.percent_off,
      minimum_subtotal = excluded.minimum_subtotal, active = excluded.active,
      expires_at = excluded.expires_at, extra = excluded.extra;
  elsif new.collection_path = 'mediaAssets' then
    insert into public.media_assets(id, name, path, url, folder, extra)
    values (
      row_id, coalesce(row_data ->> 'name', row_id),
      coalesce(row_data ->> 'path', ''), coalesce(row_data ->> 'url', ''),
      nullif(row_data ->> 'folder', ''), row_data
    )
    on conflict (id) do update set
      name = excluded.name, path = excluded.path, url = excluded.url,
      folder = excluded.folder, extra = excluded.extra;
  elsif new.collection_path = 'inbox' then
    insert into public.inbox(
      id, user_id, name, email, phone, message, status, submitted_at,
      replied_at, replies, extra
    ) values (
      row_id,
      case when coalesce(row_data ->> 'userId', '') ~* '^[0-9a-f-]{36}$' then (row_data ->> 'userId')::uuid else null end,
      coalesce(row_data ->> 'name', ''),
      coalesce(row_data ->> 'email', ''),
      coalesce(row_data ->> 'phone', ''),
      coalesce(row_data ->> 'message', ''),
      case when row_data ->> 'status' in ('new', 'read', 'replied', 'archived') then row_data ->> 'status' else 'new' end,
      case when coalesce(row_data ->> 'submittedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (row_data ->> 'submittedAt')::timestamptz else now() end,
      case when coalesce(row_data ->> 'repliedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (row_data ->> 'repliedAt')::timestamptz else null end,
      case when jsonb_typeof(row_data -> 'replies') = 'array' then row_data -> 'replies' else '[]'::jsonb end,
      row_data
    )
    on conflict (id) do update set
      user_id = excluded.user_id, name = excluded.name, email = excluded.email,
      phone = excluded.phone, message = excluded.message, status = excluded.status,
      submitted_at = excluded.submitted_at, replied_at = excluded.replied_at,
      replies = excluded.replies, extra = excluded.extra;
  elsif new.collection_path = 'checkoutSessions' then
    insert into public.checkout_sessions(
      user_id, email, phone, email_consent, whatsapp_recovery_consent,
      items, order_total, status, created_at, updated_at, recovery_state, extra
    ) values (
      case when coalesce(row_data ->> 'userId', row_id) ~* '^[0-9a-f-]{36}$' then coalesce(row_data ->> 'userId', row_id)::uuid else null end,
      coalesce(row_data ->> 'email', ''),
      coalesce(row_data ->> 'phone', ''),
      coalesce((row_data ->> 'emailConsent')::boolean, false),
      coalesce((row_data ->> 'whatsappRecoveryConsent')::boolean, false),
      case when jsonb_typeof(row_data -> 'items') = 'array' then row_data -> 'items' else '[]'::jsonb end,
      case when coalesce(row_data ->> 'orderTotal', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'orderTotal')::numeric else 0 end,
      coalesce(row_data ->> 'status', 'active'),
      case when coalesce(row_data ->> 'createdAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (row_data ->> 'createdAt')::timestamptz else now() end,
      case when coalesce(row_data ->> 'updatedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (row_data ->> 'updatedAt')::timestamptz else now() end,
      case when jsonb_typeof(row_data -> 'recoveryState') = 'object' then row_data -> 'recoveryState' else '{}'::jsonb end,
      row_data
    )
    on conflict (user_id) do update set
      email = excluded.email, phone = excluded.phone,
      email_consent = excluded.email_consent,
      whatsapp_recovery_consent = excluded.whatsapp_recovery_consent,
      items = excluded.items, order_total = excluded.order_total,
      status = excluded.status, updated_at = now(),
      recovery_state = excluded.recovery_state, extra = excluded.extra;
  elsif new.collection_path = 'orders' then
    insert into public.orders (
      id, user_id, full_name, email, phone, address, address_line2, city,
      province, postal_code, subtotal, quantity_tier_discount,
      buy_x_get_y_discount, coupon_code, coupon_discount, delivery_charge,
      grand_total, status, courier, tracking_number, tracking_url,
      payment_method, transaction_reference, payment_verified,
      payment_verified_at, payment_verified_by, payment_verified_by_label,
      customer_note, whatsapp_opt_in, whatsapp_updates_opt_in,
      whatsapp_marketing_opt_in, whatsapp_confirmation, voice_call, extra
    ) values (
      row_id,
      case when coalesce(row_data ->> 'userId', '') ~* '^[0-9a-f-]{36}$' then (row_data ->> 'userId')::uuid else null end,
      coalesce(row_data ->> 'fullName', ''),
      coalesce(row_data ->> 'email', ''),
      coalesce(row_data ->> 'phone', ''),
      coalesce(row_data ->> 'address', ''),
      nullif(row_data ->> 'addressLine2', ''),
      coalesce(row_data ->> 'city', ''),
      coalesce(row_data ->> 'province', ''),
      nullif(row_data ->> 'postalCode', ''),
      case when coalesce(row_data ->> 'subtotal', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'subtotal')::numeric else 0 end,
      case when coalesce(row_data ->> 'quantityTierDiscount', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'quantityTierDiscount')::numeric else 0 end,
      case when coalesce(row_data ->> 'buyXGetYDiscount', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'buyXGetYDiscount')::numeric else 0 end,
      coalesce(row_data ->> 'couponCode', ''),
      case when coalesce(row_data ->> 'couponDiscount', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'couponDiscount')::numeric else 0 end,
      case when coalesce(row_data ->> 'deliveryCharge', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'deliveryCharge')::numeric else 0 end,
      case when coalesce(row_data ->> 'grandTotal', '') ~ '^[0-9]+([.][0-9]+)?$' then (row_data ->> 'grandTotal')::numeric else 0 end,
      case when row_data ->> 'status' in ('Pending', 'Processing', 'Confirmed by Call', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled') then row_data ->> 'status' else 'Pending' end,
      coalesce(row_data ->> 'courier', ''),
      coalesce(row_data ->> 'trackingNumber', ''),
      nullif(row_data ->> 'trackingUrl', ''),
      case when row_data ->> 'paymentMethod' in ('BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'COD') then row_data ->> 'paymentMethod' else 'COD' end,
      nullif(row_data ->> 'transactionReference', ''),
      coalesce((row_data ->> 'paymentVerified')::boolean, false),
      case when coalesce(row_data ->> 'paymentVerifiedAt', '') <> '' then (row_data ->> 'paymentVerifiedAt')::timestamptz else null end,
      nullif(row_data ->> 'paymentVerifiedBy', ''),
      nullif(row_data ->> 'paymentVerifiedByLabel', ''),
      nullif(row_data ->> 'customerNote', ''),
      coalesce((row_data ->> 'whatsappOptIn')::boolean, false),
      coalesce((row_data ->> 'whatsappUpdatesOptIn')::boolean, false),
      coalesce((row_data ->> 'whatsappMarketingOptIn')::boolean, false),
      case when jsonb_typeof(row_data -> 'whatsappConfirmation') = 'object' then row_data -> 'whatsappConfirmation' else null end,
      case when jsonb_typeof(row_data -> 'voiceCall') = 'object' then row_data -> 'voiceCall' else null end,
      row_data
    )
    on conflict (id) do update set
      user_id = excluded.user_id, full_name = excluded.full_name,
      email = excluded.email, phone = excluded.phone, address = excluded.address,
      address_line2 = excluded.address_line2, city = excluded.city,
      province = excluded.province, postal_code = excluded.postal_code,
      subtotal = excluded.subtotal, quantity_tier_discount = excluded.quantity_tier_discount,
      buy_x_get_y_discount = excluded.buy_x_get_y_discount, coupon_code = excluded.coupon_code,
      coupon_discount = excluded.coupon_discount, delivery_charge = excluded.delivery_charge,
      grand_total = excluded.grand_total, status = excluded.status,
      courier = excluded.courier, tracking_number = excluded.tracking_number,
      tracking_url = excluded.tracking_url, payment_method = excluded.payment_method,
      transaction_reference = excluded.transaction_reference,
      payment_verified = excluded.payment_verified,
      payment_verified_at = excluded.payment_verified_at,
      payment_verified_by = excluded.payment_verified_by,
      payment_verified_by_label = excluded.payment_verified_by_label,
      customer_note = excluded.customer_note,
      whatsapp_opt_in = excluded.whatsapp_opt_in,
      whatsapp_updates_opt_in = excluded.whatsapp_updates_opt_in,
      whatsapp_marketing_opt_in = excluded.whatsapp_marketing_opt_in,
      whatsapp_confirmation = excluded.whatsapp_confirmation,
      voice_call = excluded.voice_call, extra = excluded.extra;

    if jsonb_typeof(row_data -> 'items') = 'array' then
      delete from public.order_items where order_id = row_id;
      insert into public.order_items(
        order_id, product_id, quantity, variant, variant_id, unit_price, product_snapshot
      )
      select
        row_id,
        case when coalesce(item -> 'product' ->> 'id', '') ~ '^[0-9]+$' then (item -> 'product' ->> 'id')::bigint else null end,
        case when coalesce(item ->> 'quantity', '') ~ '^[1-9][0-9]*$' then (item ->> 'quantity')::integer else 1 end,
        coalesce(item ->> 'variant', 'Standard'),
        nullif(item ->> 'variantId', ''),
        case when coalesce(item -> 'product' ->> 'price', '') ~ '^[0-9]+([.][0-9]+)?$' then (item -> 'product' ->> 'price')::numeric else 0 end,
        case when jsonb_typeof(item -> 'product') = 'object' then item -> 'product' else '{}'::jsonb end
      from jsonb_array_elements(row_data -> 'items') as line(item);
    end if;
  elsif new.path = 'storeContent/global' then
    insert into public.store_config(id, content, settings, policies, extra)
    values (
      'global',
      case when jsonb_typeof(row_data -> 'content') = 'object' then row_data -> 'content' else '{}'::jsonb end,
      case when jsonb_typeof(row_data -> 'settings') = 'object' then row_data -> 'settings' else '{}'::jsonb end,
      case when jsonb_typeof(row_data -> 'policies') = 'object' then row_data -> 'policies' else '{}'::jsonb end,
      row_data
    )
    on conflict (id) do update set
      content = excluded.content, settings = excluded.settings,
      policies = excluded.policies, extra = excluded.extra, updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.sync_store_document_to_normalized() from public;
drop trigger if exists sync_store_document_to_normalized on public.store_documents;
create trigger sync_store_document_to_normalized
  after insert or update or delete on public.store_documents
  for each row execute function public.sync_store_document_to_normalized();

comment on table public.store_documents is
  'RLS-protected JSONB records for flexible storefront settings and migration compatibility. Use normalized tables for new stable data.';
comment on function public.apply_store_documents_batch(jsonb) is
  'Atomically applies up to 500 caller-authorized document writes while preserving row-level security.';

commit;

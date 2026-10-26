begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(28);

select has_table('public', 'products', 'the normalized product table exists');
select has_table('public', 'store_documents', 'the storefront document table exists');
select has_table('public', 'orders', 'the order table exists');

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'test-customer@example.invalid', '{"display_name":"Test Customer"}')
on conflict (id) do nothing;

insert into public.store_documents (path, collection_path, document_id, payload)
values
  ('products/990001', 'products', '990001', '{"id":990001,"name":"Runtime test item","category":"Testing","price":100,"stock":5,"inStock":true,"status":"active"}'),
  ('products/990002', 'products', '990002', '{"id":990002,"name":"Cancellation test item","category":"Testing","price":50,"stock":3,"inStock":true,"status":"active"}'),
  ('products/990003', 'products', '990003', '{"id":990003,"name":"Variant test item","category":"Testing","price":20,"stock":4,"inStock":true,"status":"active","variantMatrix":[{"id":"red","label":"Red","stock":3,"price":20},{"id":"blue","label":"Blue","stock":1,"price":20}]}'),
  ('adminAccess/private-test', 'adminAccess', 'private-test', '{"secret":"not-public"}')
on conflict (path) do update set payload = excluded.payload, updated_at = now();

create temporary table storefront_test_context (
  request_id text not null,
  order_payload jsonb not null
) on commit drop;
grant select on storefront_test_context to service_role;
insert into storefront_test_context (request_id, order_payload)
values (
  'offline-test-request-0001',
  '{"requestId":"offline-test-request-0001","items":[{"productId":"990001","quantity":2,"product":{"id":990001,"name":"Runtime test item","price":100}}],"subtotal":200,"grandTotal":200}'
);

select is(
  (select count(*)::integer from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  1,
  'a new auth user receives a storefront profile'
);
select is(
  (select count(*)::integer from public.products where id = 990001 and status = 'active' and price = 100),
  1,
  'product documents synchronize to the normalized catalog'
);
select is(
  (select count(*)::integer from public.store_config where id = 'global'),
  0,
  'an uninitialized storefront does not require seed configuration'
);
select is(
  (select count(*)::integer from storage.buckets where id = 'store-assets' and public),
  1,
  'the public image bucket is created by migration'
);

set local role anon;
select is(
  (select count(*)::integer from public.store_documents where path = 'products/990001'),
  1,
  'anonymous visitors can read storefront catalog documents'
);
select is(
  (select count(*)::integer from public.store_documents where path = 'adminAccess/private-test'),
  0,
  'anonymous visitors cannot read private documents'
);
reset role;

set local role service_role;
select is(
  (
    select public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      order_payload
    ) ->> 'id'
    from storefront_test_context
  ),
  (
    select public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      order_payload
    ) ->> 'id'
    from storefront_test_context
  ),
  'repeating a checkout request returns the same order'
);
reset role;
select is(
  (select count(*)::integer
   from public.store_documents
   where collection_path = 'orders'
     and payload ->> 'requestId' = 'offline-test-request-0001'),
  1,
  'an idempotent checkout creates only one order'
);
select is(
  (select payload ->> 'stock' from public.store_documents where path = 'products/990001'),
  '3',
  'checkout decrements inventory once and atomically'
);
set local role service_role;
select is(
  public.claim_store_document_field(
    'adminAccess/private-test',
    'claim',
    '{"status":"sending"}',
    array['sent', 'sending']
  ),
  true,
  'the first automation worker claims a document state'
);
select is(
  public.claim_store_document_field(
    'adminAccess/private-test',
    'claim',
    '{"status":"sending"}',
    array['sent', 'sending']
  ),
  false,
  'a second automation worker cannot claim a sending state'
);
update public.store_documents
   set payload = jsonb_set(
     jsonb_set(payload, '{paymentMethod}', '"COD"'::jsonb, true),
     '{voiceCall}',
     '{"status":"dispatched","nonceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","events":[]}'::jsonb,
     true
   )
 where path = (
   select path from public.store_documents
    where collection_path = 'orders'
      and payload ->> 'requestId' = 'offline-test-request-0001'
 );
select is(
  public.process_voice_call_response(
    (select document_id from public.store_documents where collection_path = 'orders' and payload ->> 'requestId' = 'offline-test-request-0001'),
    repeat('a', 64),
    '2'
  ),
  'cancelled',
  'a signed voice callback cancels the order'
);
select is(
  (select payload ->> 'stock' from public.store_documents where path = 'products/990001'),
  '5',
  'voice cancellation restores inventory atomically'
);
select is(
  public.process_voice_call_response(
    (select document_id from public.store_documents where collection_path = 'orders' and payload ->> 'requestId' = 'offline-test-request-0001'),
    repeat('a', 64),
    '2'
  ),
  'invalid',
  'a processed voice nonce cannot be replayed'
);
reset role;
insert into storefront_test_context (request_id, order_payload)
values (
  'offline-test-request-0002',
  '{"requestId":"offline-test-request-0002","paymentMethod":"COD","items":[{"productId":"990002","quantity":1,"product":{"id":990002,"name":"Cancellation test item","price":50}}],"subtotal":50,"grandTotal":50}'
);
set local role service_role;
select public.place_store_order(
  '11111111-1111-4111-8111-111111111111',
  order_payload
)
from storefront_test_context
where request_id = 'offline-test-request-0002';
select is(
  public.cancel_store_order(
    (select document_id from public.store_documents where collection_path = 'orders' and payload ->> 'requestId' = 'offline-test-request-0002'),
    '11111111-1111-4111-8111-111111111111'
  ),
  true,
  'a customer can cancel a pending order'
);
select is(
  (select payload ->> 'stock' from public.store_documents where path = 'products/990002'),
  '3',
  'customer cancellation restores inventory atomically'
);
reset role;
insert into storefront_test_context (request_id, order_payload)
values (
  'offline-test-request-0003',
  '{"requestId":"offline-test-request-0003","paymentMethod":"COD","items":[{"productId":"990003","quantity":1,"variant":"Red","variantId":"red","product":{"id":990003,"name":"Variant test item","price":20}}],"subtotal":20,"grandTotal":20}'
);
set local role service_role;
select public.place_store_order(
  '11111111-1111-4111-8111-111111111111',
  order_payload
)
from storefront_test_context
where request_id = 'offline-test-request-0003';
select is(
  (select payload ->> 'stock' from public.store_documents where path = 'products/990003'),
  '3',
  'checkout decrements aggregate stock for a selected variant'
);
select is(
  (select payload -> 'variantMatrix' -> 0 ->> 'stock' from public.store_documents where path = 'products/990003'),
  '2',
  'checkout decrements the selected variant stock'
);
select public.cancel_store_order(
  (select document_id from public.store_documents where collection_path = 'orders' and payload ->> 'requestId' = 'offline-test-request-0003'),
  '11111111-1111-4111-8111-111111111111'
);
select is(
  (select payload -> 'variantMatrix' -> 0 ->> 'stock' from public.store_documents where path = 'products/990003'),
  '3',
  'cancellation restores selected variant stock'
);
select is(
  public.reopen_store_order(
    (select document_id from public.store_documents where collection_path = 'orders' and payload ->> 'requestId' = 'offline-test-request-0003'),
    '11111111-1111-4111-8111-111111111111',
    'Pending'
  )::text,
  'true',
  'admin can reopen a cancelled order atomically'
);
select is(
  (select payload ->> 'status' from public.store_documents where collection_path = 'orders' and payload ->> 'requestId' = 'offline-test-request-0003'),
  'Pending',
  'reopened order receives the requested valid status'
);
select is(
  (select payload -> 'variantMatrix' -> 0 ->> 'stock' from public.store_documents where path = 'products/990003'),
  '2',
  'reopening reserves the selected variant inventory again'
);
reset role;
set local role service_role;
select is(
  public.consume_store_rate_limit('offline-test-rate-limit', 2, 60),
  true,
  'the first request is admitted by the rate limiter'
);
select is(
  public.consume_store_rate_limit('offline-test-rate-limit', 2, 60),
  true,
  'the second request is admitted by the rate limiter'
);
select is(
  public.consume_store_rate_limit('offline-test-rate-limit', 2, 60),
  false,
  'requests above the configured limit are rejected'
);
reset role;

select * from finish();
rollback;

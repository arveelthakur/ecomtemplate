begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  12582912,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_assets_public_read on storage.objects;
create policy store_assets_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'store-assets');

drop policy if exists store_assets_admin_upload on storage.objects;
create policy store_assets_admin_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'store-assets'
    and public.is_store_admin()
  );

drop policy if exists store_assets_admin_update on storage.objects;
create policy store_assets_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'store-assets'
    and public.is_store_admin()
  )
  with check (
    bucket_id = 'store-assets'
    and public.is_store_admin()
  );

drop policy if exists store_assets_admin_delete on storage.objects;
create policy store_assets_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'store-assets'
    and public.is_store_admin()
  );

commit;

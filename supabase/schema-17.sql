-- ============================================================================
-- Foto de produto. Idempotente.
--   - products.image_url
--   - bucket público 'products' + policies (leitura pública, escrita autenticada)
-- ============================================================================

alter table public.products add column if not exists image_url text;

insert into storage.buckets (id, name, public)
  values ('products', 'products', true)
  on conflict (id) do update set public = true;

drop policy if exists products_public_read on storage.objects;
create policy products_public_read on storage.objects for select
  using (bucket_id = 'products');

drop policy if exists products_auth_insert on storage.objects;
create policy products_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'products');

drop policy if exists products_auth_update on storage.objects;
create policy products_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'products') with check (bucket_id = 'products');

drop policy if exists products_auth_delete on storage.objects;
create policy products_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'products');

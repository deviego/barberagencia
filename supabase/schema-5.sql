-- ============================================================================
-- Barbearia White-Label — schema v5 (aditivo). Rode DEPOIS de schema.sql/2/3/4.
-- Pedidos de plano (troca/cancelamento com aprovação do admin) + avatar_url +
-- bucket de fotos (Storage) + Realtime. Idempotente.
-- ============================================================================

-- ---- Pedidos de plano (aguardam aprovação do admin) ------------------------
create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('CHANGE','CANCEL')),
  combo_plan_id uuid references public.combo_plans(id),   -- alvo da troca (null p/ cancelamento)
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists plan_requests_tenant_status_idx on public.plan_requests (tenant_id, status);
create index if not exists plan_requests_client_idx on public.plan_requests (client_id);

alter table public.plan_requests enable row level security;

drop policy if exists plan_requests_read on public.plan_requests;
create policy plan_requests_read on public.plan_requests for select
  using (public.owns_client(client_id) or (tenant_id = public.auth_tenant_id() and public.is_admin()));
drop policy if exists plan_requests_client_insert on public.plan_requests;
create policy plan_requests_client_insert on public.plan_requests for insert
  with check (public.owns_client(client_id) and tenant_id = public.auth_tenant_id());
drop policy if exists plan_requests_admin on public.plan_requests;
create policy plan_requests_admin on public.plan_requests for all
  using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- ---- Foto de perfil / cliente ----------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.clients  add column if not exists avatar_url text;

-- ---- Storage: bucket público de avatars ------------------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists avatars_auth_insert on storage.objects;
create policy avatars_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');
drop policy if exists avatars_auth_update on storage.objects;
create policy avatars_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
drop policy if exists avatars_auth_delete on storage.objects;
create policy avatars_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');

-- ---- Realtime para os pedidos de plano -------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.plan_requests;
  exception when duplicate_object then null;
  end;
end $$;

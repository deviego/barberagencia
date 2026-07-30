-- Configurações da unidade (por barbearia): contato, horários e flag de onboarding.
create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  phone text,
  address text,
  hours_weekday text,
  hours_saturday text,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.tenant_settings enable row level security;

drop policy if exists ts_read on public.tenant_settings;
create policy ts_read on public.tenant_settings
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists ts_admin on public.tenant_settings;
create policy ts_admin on public.tenant_settings
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- ============================================================================
-- Carteira de clientes do distribuidor (Fase 1b).
--   tenant_id = o DISTRIBUIDOR dono; customer_tenant_id = barbearia vinculada
--   (quando a barbearia é cliente da plataforma). RLS por tenant (auth_tenant_id).
--   Idempotente.
-- ============================================================================

create table if not exists public.distributor_customers (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,   -- distribuidor dono
  customer_tenant_id uuid references public.tenants(id) on delete set null,           -- barbearia vinculada (opcional)
  contact_name       text,
  contact_phone      text,
  contact_email      text,
  legal_name         text,
  trade_name         text,
  address_street     text,
  address_city       text,
  address_state      text,
  address_zip        text,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists idx_distcust_tenant on public.distributor_customers(tenant_id);
create index if not exists idx_distcust_customer on public.distributor_customers(customer_tenant_id);

alter table public.distributor_customers enable row level security;

-- O distribuidor (UNIT_ADMIN do próprio tenant) gerencia a própria carteira.
drop policy if exists distcust_admin on public.distributor_customers;
create policy distcust_admin on public.distributor_customers
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

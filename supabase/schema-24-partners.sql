-- ============================================================================
-- Parceiros / afiliados (embaixadores, divulgadores, distribuidores)
--   Cada parceiro tem um ref_code (link de afiliado). Barbearias indicadas
--   apontam para o parceiro via tenants.referred_by_partner_id.
--   Idempotente. RLS sem policy = só service-role (padrão de wa_sessions).
-- ============================================================================

create table if not exists public.partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text not null default 'DIVULGADORA' check (type in ('EMBAIXADORA','DIVULGADORA','DISTRIBUIDOR')),
  is_barbershop  boolean not null default false,
  tenant_id      uuid references public.tenants(id) on delete set null,  -- se for barbearia já no sistema
  ref_code       text unique not null,                                   -- código do link de afiliado (?ref=)
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  instagram      text,
  commission_kind  text not null default 'PCT' check (commission_kind in ('PCT','FIXED','NONE')),
  commission_value numeric not null default 0,                           -- % (PCT) ou R$ (FIXED)
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_partners_ref on public.partners(ref_code);
alter table public.partners enable row level security;  -- service-role only

-- Atribuição: qual parceiro indicou cada barbearia.
alter table public.tenants add column if not exists referred_by_partner_id uuid references public.partners(id);
create index if not exists idx_tenants_partner on public.tenants(referred_by_partner_id);

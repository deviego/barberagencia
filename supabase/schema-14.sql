-- ============================================================================
-- Contratos de assinatura por barbearia (tenant_contracts). Idempotente.
--   - 1 contrato por tenant (dados legais do ASSINANTE + gestão do teste + assinatura).
--   - Assinatura eletrônica (MP 2.200-2/2001): snapshot + hash congelados no aceite.
--   - RLS: admin/master(acting) vê e assina o PRÓPRIO contrato. Criação/edição de dados
--     legais é feita por service-role (fluxo MASTER nas server actions).
-- ============================================================================

create table if not exists public.tenant_contracts (
  tenant_id         uuid primary key references public.tenants(id) on delete cascade,

  -- ASSINANTE (dados legais que preenchem o contrato)
  legal_name        text,          -- razão social
  trade_name        text,          -- nome fantasia
  doc_type          text check (doc_type in ('CNPJ','CPF')),
  doc_number        text,
  responsible_name  text,          -- responsável legal
  responsible_cpf   text,
  address_street    text,
  address_city      text,
  address_state     text,
  address_zip       text,
  contact_email     text,
  contact_phone     text,

  -- Gestão do teste/contrato
  plan              text,                                   -- snapshot do saas_plan
  contract_version  text not null default '2026-08-v1',
  trial_enabled     boolean not null default true,          -- master ligou os 15 dias?
  trial_started_at  timestamptz not null default now(),
  trial_ends_at     timestamptz not null default now(),     -- +15d se trial_enabled; senão = now (vencido)
  status            text not null default 'PENDING' check (status in ('PENDING','SIGNED')),

  -- Assinatura eletrônica
  signed_at         timestamptz,
  signed_ip         text,
  signed_by_user_id uuid,
  signed_name       text,
  accepted_text     text,
  signature_hash    text,
  contract_snapshot text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.tenant_contracts enable row level security;

-- Leitura: admin da barbearia (e MASTER atuando) vê o próprio contrato.
drop policy if exists tc_read on public.tenant_contracts;
create policy tc_read on public.tenant_contracts
  for select using (tenant_id = public.auth_tenant_id());

-- Atualização (assinatura): admin da própria barbearia. Usado pela server action de assinar.
drop policy if exists tc_update on public.tenant_contracts;
create policy tc_update on public.tenant_contracts
  for update using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- INSERT e edição de dados legais: apenas service-role (server actions do MASTER). Sem policy p/ authenticated.

-- ---- Backfill: cria contrato PENDING para tenants sem contrato ----------------
insert into public.tenant_contracts (tenant_id, plan, trial_enabled, trial_started_at, trial_ends_at, status)
select t.id, t.saas_plan, true, t.created_at, t.created_at + interval '15 days', 'PENDING'
from public.tenants t
where not exists (select 1 from public.tenant_contracts c where c.tenant_id = t.id);

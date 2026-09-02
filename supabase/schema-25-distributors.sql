-- ============================================================================
-- Distribuidores (Fase 0): discriminador de tipo de tenant.
--   Um distribuidor é um tenant com kind='DISTRIBUTOR' (membership UNIT_ADMIN),
--   com painel próprio (/distributor) e cobrança reaproveitando o billing.
--   Idempotente.
-- ============================================================================

alter table public.tenants
  add column if not exists kind text not null default 'BARBERSHOP'
  check (kind in ('BARBERSHOP','DISTRIBUTOR'));
create index if not exists idx_tenants_kind on public.tenants(kind);

-- Libera saas_plan para aceitar as chaves de plano do distribuidor
-- (remove o CHECK fixo dos 3 planos de barbearia; a validação passa a ser em código).
alter table public.tenants drop constraint if exists tenants_saas_plan_check;

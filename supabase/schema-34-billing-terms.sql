-- ============================================================================
-- schema-34 — Condições vendidas por barbearia + competência nos pagamentos do SaaS
-- (Epic 01 · S0/S1). Aditivo e idempotente. Não apaga dado.
--
--   tenant_billing_terms: preço promocional, nº de competências de promoção e preço
--     cheio, gravados na barbearia no fechamento. O fim da promoção ou uma mudança de
--     tabela não altera o que já foi vendido.
--   saas_payments: + competencia_from/to, expected_brl, partial. Permite contar por
--     competência (1ª mensalidade paga em duas partes = 1 competência).
--
-- Acesso: RLS ligada e SEM policy → só service-role (padrão de saas_payments). O app
-- só lê/grava pelo painel do master, com checagem isMaster no servidor.
-- Depende de: schema-23 (saas_payments) e schema-25 (tenants.kind).
-- Rollback: drop table public.tenant_billing_terms; as colunas novas de
-- saas_payments podem ficar (nulas/false não mudam nada no código antigo).
-- ============================================================================

create table if not exists public.tenant_billing_terms (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  plan             text not null,
  promo_price_brl  numeric(10,2) check (promo_price_brl is null or promo_price_brl >= 0),
  promo_months     int not null default 0 check (promo_months between 0 and 24),
  full_price_brl   numeric(10,2) not null check (full_price_brl >= 0),
  source           text not null default 'TABLE' check (source in ('TABLE','BACKFILL','MANUAL')),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

alter table public.tenant_billing_terms enable row level security;
revoke all on table public.tenant_billing_terms from anon, authenticated;
grant all on table public.tenant_billing_terms to service_role;

-- Barbearias que já existem recebem a tabela atual do plano (não sobrescreve se já houver).
insert into public.tenant_billing_terms (tenant_id, plan, promo_price_brl, promo_months, full_price_brl, source)
select t.id,
       t.saas_plan,
       case t.saas_plan when 'personal' then 69.90 when 'essencial' then 89.90 else null end,
       case t.saas_plan when 'personal' then 2     when 'essencial' then 2     else 0    end,
       case t.saas_plan when 'personal' then 129.90 when 'essencial' then 189.90 else 249.90 end,
       'BACKFILL'
  from public.tenants t
 where coalesce(t.kind, 'BARBERSHOP') = 'BARBERSHOP'
   and t.saas_plan in ('personal', 'essencial', 'advance')
on conflict (tenant_id) do nothing;

-- Competência nos pagamentos (linhas antigas ficam nulas = legado; o app deduz pelo paid_until).
alter table public.saas_payments add column if not exists competencia_from int;
alter table public.saas_payments add column if not exists competencia_to   int;
alter table public.saas_payments add column if not exists expected_brl     numeric(10,2);
alter table public.saas_payments add column if not exists partial          boolean not null default false;

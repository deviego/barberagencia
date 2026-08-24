-- ============================================================================
-- Cobrança manual da mensalidade do SaaS (barbearia → plataforma)
--   Sem gateway: o MASTER registra o pagamento no painel e renova a vigência.
--   Idempotente. Não apaga dado.
-- ============================================================================

create table if not exists public.saas_payments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  plan         text,
  amount_brl   numeric not null,
  method       text,                       -- PIX | CASH | CARD | OUTRO
  paid_at      timestamptz not null default now(),
  paid_until   timestamptz,                -- vigência resultante após este pagamento
  reference    text,                        -- ex.: "08/2026"
  note         text,
  created_by   uuid,                        -- master que registrou
  created_at   timestamptz not null default now()
);
create index if not exists idx_saas_payments_tenant on public.saas_payments(tenant_id, paid_at desc);

-- RLS ligada e SEM policy => acessível apenas via service-role (padrão de wa_sessions).
alter table public.saas_payments enable row level security;

-- Vigência atual da mensalidade (separado do fim do trial).
alter table public.tenant_contracts add column if not exists paid_until timestamptz;

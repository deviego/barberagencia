-- schema-35: marketing_leads — leads de formulários públicos da landing (story #83).
-- Idempotente (pode rodar mais de uma vez).
--
-- Segurança:
--   * RLS ligada e NENHUMA policy: anon/authenticated não leem nem gravam.
--   * Grants revogados de anon/authenticated (defesa em profundidade).
--   * Só o servidor grava (server action com service role) e só o Master lê (/master/leads).
--   * ip_hash = sha256(ip + salt do servidor). O IP cru nunca é gravado.
--   * Pedido do titular: anonimizar os campos pessoais (anonymized_at), sem apagar a linha.
--
-- Rollback: drop table if exists public.marketing_leads;  (só antes de ter leads reais)

create table if not exists public.marketing_leads (
  id                uuid primary key default gen_random_uuid(),
  origem            text not null,
  name              text,
  company           text,
  city              text,
  state             text,
  whatsapp          text,
  barbershops_count int,
  order_channel     text,
  consent_at        timestamptz not null,
  consent_version   text not null,
  ip_hash           text,
  status            text not null default 'NEW',
  anonymized_at     timestamptz,
  created_at        timestamptz not null default now()
);

-- Checks (recriados para ficar idempotente).
alter table public.marketing_leads drop constraint if exists marketing_leads_origem_check;
alter table public.marketing_leads add constraint marketing_leads_origem_check
  check (origem in ('landing-distribuidora'));

alter table public.marketing_leads drop constraint if exists marketing_leads_status_check;
alter table public.marketing_leads add constraint marketing_leads_status_check
  check (status in ('NEW', 'CONTACTED', 'DISCARDED'));

alter table public.marketing_leads drop constraint if exists marketing_leads_state_check;
alter table public.marketing_leads add constraint marketing_leads_state_check
  check (state is null or state in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));

alter table public.marketing_leads drop constraint if exists marketing_leads_barbershops_count_check;
alter table public.marketing_leads add constraint marketing_leads_barbershops_count_check
  check (barbershops_count is null or barbershops_count between 0 and 100000);

alter table public.marketing_leads drop constraint if exists marketing_leads_order_channel_check;
alter table public.marketing_leads add constraint marketing_leads_order_channel_check
  check (order_channel is null or order_channel in ('whatsapp','representante','planilha','outro'));

alter table public.marketing_leads drop constraint if exists marketing_leads_lengths_check;
alter table public.marketing_leads add constraint marketing_leads_lengths_check
  check (
        (name is null or char_length(name) <= 80)
    and (company is null or char_length(company) <= 120)
    and (city is null or char_length(city) <= 80)
    and (whatsapp is null or char_length(whatsapp) <= 20)
    and char_length(consent_version) <= 40
    and (ip_hash is null or char_length(ip_hash) <= 64)
  );

-- Campos pessoais obrigatórios enquanto o lead não foi anonimizado.
alter table public.marketing_leads drop constraint if exists marketing_leads_required_check;
alter table public.marketing_leads add constraint marketing_leads_required_check
  check (anonymized_at is not null or (name is not null and whatsapp is not null));

create index if not exists marketing_leads_ip_hash_created_idx on public.marketing_leads (ip_hash, created_at);
create index if not exists marketing_leads_created_idx on public.marketing_leads (created_at);

alter table public.marketing_leads enable row level security;
-- Sem policies de propósito: nenhum acesso via PostgREST para anon/authenticated.
revoke all on table public.marketing_leads from anon, authenticated;

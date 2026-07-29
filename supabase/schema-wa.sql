-- Sessões do gateway de WhatsApp (Baileys). Só o service-role (gateway) acessa.
create table if not exists public.wa_sessions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  creds jsonb,
  keys jsonb,
  number text,
  updated_at timestamptz not null default now()
);
alter table public.wa_sessions enable row level security;
-- Sem policies: anon/authenticated não leem. O gateway usa a service-role key (bypassa RLS).

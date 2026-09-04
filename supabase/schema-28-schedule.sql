-- ============================================================================
-- Barbearia White-Label — schema v28 (aditivo). Gestão de horários da agenda.
-- Passo configurável dos slots + bloqueios/folgas da agenda + RPC de leitura.
-- Idempotente. Rode com: node dbadmin.mjs supabase/schema-28-schedule.sql
-- ============================================================================

-- ---- Passo (espaçamento) dos horários, por barbearia. Default 30 min. -------
alter table public.tenant_settings
  add column if not exists slot_step_min int not null default 30;

-- ---- Bloqueios / folgas da agenda ------------------------------------------
-- barber_id NULL = bloqueio da barbearia inteira (todos os barbeiros).
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists schedule_blocks_lookup_idx
  on public.schedule_blocks (tenant_id, barber_id, starts_at);

alter table public.schedule_blocks enable row level security;

drop policy if exists schedule_blocks_admin on public.schedule_blocks;
create policy schedule_blocks_admin on public.schedule_blocks for all
  using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- ---- RPC: bloqueios de um barbeiro (ou da barbearia toda) num intervalo -----
-- SECURITY DEFINER para o cliente conseguir cinzar os horários bloqueados
-- (a RLS admin-only esconderia a tabela dele). Escopo derivado do barbeiro.
create or replace function public.blocked_ranges(
  p_barber_id uuid, p_from timestamptz, p_to timestamptz
) returns table (starts_at timestamptz, ends_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select b.starts_at, b.ends_at
    from public.schedule_blocks b
    join public.barbers ba on ba.id = p_barber_id
   where b.tenant_id = ba.tenant_id
     and (b.barber_id = p_barber_id or b.barber_id is null)
     and b.starts_at < p_to and b.ends_at > p_from
$$;

grant execute on function public.blocked_ranges(uuid, timestamptz, timestamptz) to authenticated;

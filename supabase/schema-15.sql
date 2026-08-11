-- ============================================================================
-- Limitação por plano (entitlements). Idempotente.
--   - plan_upgrade_requests: solicitações de upgrade (admin pede, master resolve).
--   - trigger de limite de PROFISSIONAIS no banco (barbeiros são criados client-side
--     via CrudTable, então o teto é garantido aqui, independentemente do caminho).
--   - Só limita após o teste (tenant_contracts.trial_ends_at <= now).
-- ============================================================================

create table if not exists public.plan_upgrade_requests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  current_plan   text,
  requested_plan text,
  reason         text,
  requested_by   uuid,
  status         text not null default 'PENDING' check (status in ('PENDING','DONE','REJECTED')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists idx_pur_tenant on public.plan_upgrade_requests(tenant_id);
create index if not exists idx_pur_status on public.plan_upgrade_requests(status);

alter table public.plan_upgrade_requests enable row level security;

-- Admin da barbearia cria e vê as próprias solicitações. Master lista via service-role.
drop policy if exists pur_admin on public.plan_upgrade_requests;
create policy pur_admin on public.plan_upgrade_requests
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- ---- Teto de profissionais por plano (só após o teste) ----------------------
create or replace function public.plan_barber_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text; v_ends timestamptz; v_max int; v_count int;
begin
  select saas_plan into v_plan from public.tenants where id = new.tenant_id;
  select trial_ends_at into v_ends from public.tenant_contracts where tenant_id = new.tenant_id;

  -- Durante o teste (ou sem contrato), não limita.
  if v_ends is null or v_ends > now() then
    return new;
  end if;

  v_max := case v_plan
             when 'personal' then 3
             when 'essencial' then 5
             when 'advance' then 8
             else 8
           end;

  select count(*) into v_count
    from public.barbers
   where tenant_id = new.tenant_id and deleted_at is null and active = true;

  if v_count >= v_max then
    raise exception 'Limite de profissionais do plano atingido (%). Faça upgrade para adicionar mais.', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_barber_limit on public.barbers;
create trigger trg_barber_limit before insert on public.barbers
  for each row execute function public.plan_barber_limit();

-- ============================================================================
-- Plano FIXO: débito de cortes (admin "Remover um corte"). Idempotente.
--   - appointments.plan_debited: reserva do plano cancelada por DÉBITO (o cliente já
--     usou esse corte, ex.: cortou antes de assinar). A data continua "ocupando" a janela
--     rolante, então o ensure_fixed_reservations NÃO a recria — o débito não se desfaz.
--   - O saldo (reservados) só conta reservas ativas; as debitadas ficam de fora.
-- ============================================================================

alter table public.appointments
  add column if not exists plan_debited boolean not null default false;

create or replace function public.ensure_fixed_reservations(p_client_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_sub record;
  v_svc record;
  v_cuts int;
  v_have int;
  v_now_local timestamp;
  v_local timestamp;
  v_start timestamptz;
  v_appt uuid;
  v_guard int := 0;
begin
  if not (public.owns_client(p_client_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;

  select s.*, c.cuts as plan_cuts, c.booking_mode as plan_mode
    into v_sub
    from public.client_subscriptions s
    join public.combo_plans c on c.id = s.combo_plan_id
   where s.client_id = p_client_id and s.status = 'ACTIVE'
   limit 1;

  if v_sub is null or v_sub.plan_mode <> 'FIXED'
     or v_sub.fixed_weekday is null or v_sub.fixed_start_min is null
     or v_sub.fixed_barber_id is null or v_sub.fixed_service_id is null then
    return 0;
  end if;

  v_cuts := greatest(1, coalesce(v_sub.plan_cuts, 1));
  select name, price_brl, duration_min into v_svc from public.services where id = v_sub.fixed_service_id;

  -- Próxima ocorrência do weekday, no horário fixo (hora local BR), estritamente futura.
  v_now_local := timezone('America/Sao_Paulo', now());
  v_local := date_trunc('day', v_now_local)
             + (((v_sub.fixed_weekday - extract(dow from v_now_local)::int) + 7) % 7) * interval '1 day'
             + v_sub.fixed_start_min * interval '1 minute';
  if timezone('America/Sao_Paulo', v_local) <= now() then
    v_local := v_local + interval '7 days';
  end if;

  loop
    -- Janela: reservas ativas + datas debitadas (estas ocupam a vaga sem gerar corte).
    select count(*) into v_have
      from public.appointments
     where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
       and consumed_from_plan = true and start_at > now()
       and (status <> 'CANCELLED' or plan_debited);
    exit when v_have >= v_cuts or v_guard > 60;
    v_guard := v_guard + 1;

    v_start := timezone('America/Sao_Paulo', v_local);

    -- Já reservado (ou debitado) nesse slot? pula a semana.
    if exists (select 1 from public.appointments
                where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
                  and start_at = v_start and (status <> 'CANCELLED' or plan_debited)) then
      v_local := v_local + interval '7 days';
      continue;
    end if;
    -- Slot do barbeiro já ocupado (por qualquer cliente)? pula a semana.
    if exists (select 1 from public.appointments
                where barber_id = v_sub.fixed_barber_id and start_at = v_start
                  and status in ('REQUESTED','CONFIRMED','ALT_OFFERED')) then
      v_local := v_local + interval '7 days';
      continue;
    end if;

    insert into public.appointments
      (tenant_id, client_id, barber_id, service_id, combo_plan_id, start_at, status, consumed_from_plan)
    values
      (v_sub.tenant_id, p_client_id, v_sub.fixed_barber_id, v_sub.fixed_service_id, v_sub.combo_plan_id, v_start, 'CONFIRMED', true)
    returning id into v_appt;

    insert into public.appointment_items
      (appointment_id, tenant_id, kind, ref_id, name, price_brl, qty, covered_by_plan, duration_min, added_later)
    values
      (v_appt, v_sub.tenant_id, 'service', v_sub.fixed_service_id, coalesce(v_svc.name,'Corte'),
       coalesce(v_svc.price_brl,0), 1, true, coalesce(v_svc.duration_min,30), false);

    v_local := v_local + interval '7 days';
  end loop;

  -- Saldo = só as reservas ativas (debitadas são CANCELLED e ficam de fora).
  update public.client_subscriptions
     set saldo_cortes = (select count(*) from public.appointments
                          where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
                            and consumed_from_plan = true and start_at > now() and status <> 'CANCELLED')
   where id = v_sub.id;

  return v_have;
end $$;
grant execute on function public.ensure_fixed_reservations(uuid) to authenticated;

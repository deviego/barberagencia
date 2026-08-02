-- ============================================================================
-- Planos de assinatura com HORÁRIO FIXO semanal (reserva automática). Idempotente.
--   - combo_plans.booking_mode ('FLEXIBLE' | 'FIXED') + forfeit_on_noshow
--   - client_subscriptions.fixed_weekday / fixed_start_min / fixed_barber_id / fixed_service_id
--   - RPCs: activate_fixed_plan, ensure_fixed_reservations, add_fixed_makeup,
--           cancel_future_plan_appointments
-- O slot fixo é interpretado no fuso America/Sao_Paulo (barbearia BR).
-- ============================================================================

alter table public.combo_plans
  add column if not exists booking_mode text not null default 'FLEXIBLE'
    check (booking_mode in ('FLEXIBLE','FIXED'));
alter table public.combo_plans
  add column if not exists forfeit_on_noshow boolean not null default true;

alter table public.client_subscriptions add column if not exists fixed_weekday int;
alter table public.client_subscriptions add column if not exists fixed_start_min int;
alter table public.client_subscriptions add column if not exists fixed_barber_id uuid references public.barbers(id);
alter table public.client_subscriptions add column if not exists fixed_service_id uuid references public.services(id);

-- ---- Garante a janela rolante de `cuts` reservas futuras no slot fixo --------
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
    select count(*) into v_have
      from public.appointments
     where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
       and consumed_from_plan = true and start_at > now() and status <> 'CANCELLED';
    exit when v_have >= v_cuts or v_guard > 60;
    v_guard := v_guard + 1;

    v_start := timezone('America/Sao_Paulo', v_local);

    -- Já reservado nesse slot? pula a semana.
    if exists (select 1 from public.appointments
                where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
                  and start_at = v_start and status <> 'CANCELLED') then
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

  update public.client_subscriptions
     set saldo_cortes = (select count(*) from public.appointments
                          where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
                            and consumed_from_plan = true and start_at > now() and status <> 'CANCELLED')
   where id = v_sub.id;

  return v_have;
end $$;
grant execute on function public.ensure_fixed_reservations(uuid) to anon, authenticated;

-- ---- Ativa uma assinatura de horário fixo (admin define o slot) --------------
create or replace function public.activate_fixed_plan(
  p_client_id uuid, p_combo_id uuid, p_weekday int, p_start_min int, p_barber_id uuid, p_service_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare t_id uuid; sub_id uuid; v_mode text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select tenant_id into t_id from public.clients where id = p_client_id;
  select booking_mode into v_mode from public.combo_plans where id = p_combo_id and tenant_id = t_id;
  if v_mode is null then raise exception 'combo inválido'; end if;
  if v_mode <> 'FIXED' then raise exception 'combo não é de horário fixo'; end if;
  if p_weekday is null or p_start_min is null or p_barber_id is null or p_service_id is null then
    raise exception 'defina dia, horário, barbeiro e serviço';
  end if;

  select id into sub_id from public.client_subscriptions where client_id = p_client_id limit 1;
  if sub_id is null then
    insert into public.client_subscriptions
      (tenant_id, client_id, combo_plan_id, saldo_cortes, status, fixed_weekday, fixed_start_min, fixed_barber_id, fixed_service_id)
    values (t_id, p_client_id, p_combo_id, 0, 'ACTIVE', p_weekday, p_start_min, p_barber_id, p_service_id)
    returning id into sub_id;
  else
    update public.client_subscriptions
       set combo_plan_id = p_combo_id, status = 'ACTIVE',
           fixed_weekday = p_weekday, fixed_start_min = p_start_min,
           fixed_barber_id = p_barber_id, fixed_service_id = p_service_id
     where id = sub_id;
  end if;

  perform public.ensure_fixed_reservations(p_client_id);
  return sub_id;
end $$;
grant execute on function public.activate_fixed_plan(uuid, uuid, int, int, uuid, uuid) to authenticated;

-- ---- Reposição manual de um corte (admin decide em caso de falta) ------------
create or replace function public.add_fixed_makeup(p_client_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_sub record; v_svc record; v_local timestamp; v_start timestamptz; v_appt uuid; v_guard int := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select s.*, c.booking_mode as plan_mode into v_sub
    from public.client_subscriptions s join public.combo_plans c on c.id = s.combo_plan_id
   where s.client_id = p_client_id and s.status = 'ACTIVE' limit 1;
  if v_sub is null or v_sub.plan_mode <> 'FIXED' then raise exception 'sem plano fixo ativo'; end if;

  select name, price_brl, duration_min into v_svc from public.services where id = v_sub.fixed_service_id;

  -- começa após a última reserva futura (ou próxima ocorrência) e acha o 1º slot livre
  select max(start_at) into v_start from public.appointments
   where client_id = p_client_id and combo_plan_id = v_sub.combo_plan_id
     and consumed_from_plan = true and start_at > now() and status <> 'CANCELLED';
  if v_start is null then
    v_local := timezone('America/Sao_Paulo', now());
    v_local := date_trunc('day', v_local)
             + (((v_sub.fixed_weekday - extract(dow from v_local)::int) + 7) % 7) * interval '1 day'
             + v_sub.fixed_start_min * interval '1 minute';
    if timezone('America/Sao_Paulo', v_local) <= now() then v_local := v_local + interval '7 days'; end if;
  else
    v_local := timezone('America/Sao_Paulo', v_start) + interval '7 days';
  end if;

  loop
    v_guard := v_guard + 1; exit when v_guard > 60;
    v_start := timezone('America/Sao_Paulo', v_local);
    if exists (select 1 from public.appointments
                where barber_id = v_sub.fixed_barber_id and start_at = v_start
                  and status in ('REQUESTED','CONFIRMED','ALT_OFFERED')) then
      v_local := v_local + interval '7 days'; continue;
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
    return v_start;
  end loop;
  raise exception 'nenhum horário livre encontrado';
end $$;
grant execute on function public.add_fixed_makeup(uuid) to authenticated;

-- ---- Cancela reservas futuras do plano (ao cancelar a assinatura) ------------
create or replace function public.cancel_future_plan_appointments(p_client_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.appointments set status = 'CANCELLED'
   where client_id = p_client_id and consumed_from_plan = true
     and start_at > now() and status in ('REQUESTED','CONFIRMED','ALT_OFFERED');
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.cancel_future_plan_appointments(uuid) to authenticated;

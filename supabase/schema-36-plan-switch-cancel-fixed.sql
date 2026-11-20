-- schema-36: troca de plano fixo não deixa reservas do plano antigo na agenda (bug #131).
-- Idempotente (create or replace). Compatível com o código em produção: assinaturas e retornos
-- das funções não mudam; as server actions continuam chamando do mesmo jeito.
--
-- O que muda:
--   * assign_combo: se a assinatura atual é de plano FIXO e o plano muda, cancela as reservas
--     futuras do plano substituído. Os campos fixed_* só continuam se o plano é o mesmo e fixo;
--     plano novo (combo ou outro fixo, ex.: pedido de troca aprovado) começa sem horário.
--   * activate_fixed_plan: se a assinatura atual é de plano FIXO e o plano OU o horário
--     (dia, hora, barbeiro, serviço) muda, cancela as reservas futuras do plano/horário
--     substituído antes de criar as do novo (ensure_fixed_reservations conta pelo plano, e as
--     antigas ocupavam a conta e a agenda).
--   * _cancel_replaced_fixed_reservations: helper interno, sem execução para nenhum papel do app.
--
-- O que é cancelado (status → CANCELLED), e só isso:
--   reservas do MESMO cliente, da MESMA barbearia, do plano substituído, com
--   consumed_from_plan = true, start_at > now(), status ativo (REQUESTED/CONFIRMED/ALT_OFFERED),
--   plan_debited = false e atendimento não iniciado (service_started_at is null).
-- Nunca muda: reservas passadas, atendidas (DONE), já canceladas, debitadas, em atendimento,
-- avulsas (consumed_from_plan = false), de outro cliente ou de outra barbearia.
-- Nada é apagado. Tudo dentro da mesma chamada (uma transação): se algo falha, nada muda.
-- Nenhuma mensagem de WhatsApp sai do banco.
--
-- Fora do alcance (registrado no PR): reservas de planos ainda mais antigos, deixadas na agenda
-- por trocas feitas antes desta correção, NÃO são canceladas aqui.
--
-- Guardas e grants: create or replace preserva a ACL das duas funções (schema-21/33). A guarda
-- is_admin_of_client (schema-33) continua igual.
-- Rollback: reaplicar assign_combo e activate_fixed_plan de supabase/schema-33-rpc-tenant-scope.sql
--   e drop function if exists public._cancel_replaced_fixed_reservations(uuid, uuid, uuid);

-- ---- helper interno ----------------------------------------------------------------
create or replace function public._cancel_replaced_fixed_reservations(
  p_tenant_id uuid, p_client_id uuid, p_plan_id uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_tenant_id is null or p_client_id is null or p_plan_id is null then
    return 0;
  end if;
  update public.appointments
     set status = 'CANCELLED'
   where tenant_id = p_tenant_id
     and client_id = p_client_id
     and combo_plan_id = p_plan_id
     and consumed_from_plan = true
     and start_at > now()
     and status in ('REQUESTED', 'CONFIRMED', 'ALT_OFFERED')
     and plan_debited = false
     and service_started_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Só as funções abaixo (dono) chamam; nenhum papel do app executa direto.
revoke all on function public._cancel_replaced_fixed_reservations(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---- assign_combo (fonte: schema-33-rpc-tenant-scope.sql) ---------------------------
create or replace function public.assign_combo(p_client_id uuid, p_combo_plan_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  sub_id uuid; t_id uuid; v_cuts int; v_new_mode text;
  v_old_plan uuid; v_old_mode text; v_keep_slot boolean;
begin
  if not public.is_admin_of_client(p_client_id) then
    raise exception 'forbidden';
  end if;
  select tenant_id into t_id from public.clients where id = p_client_id;
  select cuts, booking_mode into v_cuts, v_new_mode
    from public.combo_plans where id = p_combo_plan_id and tenant_id = t_id;
  if v_cuts is null then raise exception 'combo inválido'; end if;

  -- Trava a assinatura durante a troca (duas trocas ao mesmo tempo não se cruzam).
  select s.id, s.combo_plan_id into sub_id, v_old_plan
    from public.client_subscriptions s
   where s.client_id = p_client_id
   limit 1
   for update;

  if sub_id is null then
    insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, saldo_cortes, status)
    values (t_id, p_client_id, p_combo_plan_id, v_cuts, 'ACTIVE')
    returning id into sub_id;
  else
    select booking_mode into v_old_mode from public.combo_plans where id = v_old_plan;
    v_keep_slot := v_new_mode = 'FIXED' and v_old_plan = p_combo_plan_id;
    if v_old_mode = 'FIXED' and not v_keep_slot then
      perform public._cancel_replaced_fixed_reservations(t_id, p_client_id, v_old_plan);
    end if;

    -- O horário fixo só continua se o plano é o mesmo e é fixo. Plano novo (combo ou outro
    -- fixo) começa sem horário: horário de plano fixo só se define em activate_fixed_plan.
    update public.client_subscriptions
       set combo_plan_id = p_combo_plan_id, saldo_cortes = v_cuts, status = 'ACTIVE',
           fixed_weekday    = case when v_keep_slot then fixed_weekday    end,
           fixed_start_min  = case when v_keep_slot then fixed_start_min  end,
           fixed_barber_id  = case when v_keep_slot then fixed_barber_id  end,
           fixed_service_id = case when v_keep_slot then fixed_service_id end
     where id = sub_id;
  end if;
  return sub_id;
end $$;

-- ---- activate_fixed_plan (fonte: schema-33-rpc-tenant-scope.sql) --------------------
create or replace function public.activate_fixed_plan(
  p_client_id uuid, p_combo_id uuid, p_weekday int, p_start_min int, p_barber_id uuid, p_service_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  t_id uuid; sub_id uuid; v_mode text; v_service uuid;
  v_old record; v_old_mode text;
begin
  if not public.is_admin_of_client(p_client_id) then raise exception 'forbidden'; end if;
  select tenant_id into t_id from public.clients where id = p_client_id;
  select booking_mode into v_mode from public.combo_plans where id = p_combo_id and tenant_id = t_id;
  if v_mode is null then raise exception 'combo inválido'; end if;
  if v_mode <> 'FIXED' then raise exception 'combo não é de horário fixo'; end if;
  if p_weekday is null or p_start_min is null or p_barber_id is null then
    raise exception 'defina dia, horário e barbeiro';
  end if;
  -- Barbeiro precisa ser da mesma barbearia (senão a reserva ocuparia a agenda de outra).
  if not exists (select 1 from public.barbers where id = p_barber_id and tenant_id = t_id) then
    raise exception 'barbeiro inválido';
  end if;

  -- Serviço vem do plano (ou do parâmetro, ou o 1º serviço ativo como último recurso).
  v_service := coalesce(
    p_service_id,
    (select service_id from public.combo_plans where id = p_combo_id),
    (select id from public.services where tenant_id = t_id and active = true order by price_brl limit 1)
  );
  if v_service is null then raise exception 'cadastre ao menos um serviço para ativar o plano'; end if;
  if not exists (select 1 from public.services where id = v_service and tenant_id = t_id) then
    raise exception 'serviço inválido';
  end if;

  -- Trava a assinatura durante a troca.
  select s.id, s.combo_plan_id, s.fixed_weekday, s.fixed_start_min, s.fixed_barber_id, s.fixed_service_id
    into v_old
    from public.client_subscriptions s
   where s.client_id = p_client_id
   limit 1
   for update;
  sub_id := v_old.id;

  if sub_id is null then
    insert into public.client_subscriptions
      (tenant_id, client_id, combo_plan_id, saldo_cortes, status, fixed_weekday, fixed_start_min, fixed_barber_id, fixed_service_id)
    values (t_id, p_client_id, p_combo_id, 0, 'ACTIVE', p_weekday, p_start_min, p_barber_id, v_service)
    returning id into sub_id;
  else
    -- Plano fixo anterior substituído (outro plano, ou o mesmo em outro horário): as reservas
    -- futuras dele saem da agenda antes de criar as do plano/horário novo.
    select booking_mode into v_old_mode from public.combo_plans where id = v_old.combo_plan_id;
    if v_old_mode = 'FIXED' and (
         v_old.combo_plan_id is distinct from p_combo_id
      or v_old.fixed_weekday is distinct from p_weekday
      or v_old.fixed_start_min is distinct from p_start_min
      or v_old.fixed_barber_id is distinct from p_barber_id
      or v_old.fixed_service_id is distinct from v_service
    ) then
      perform public._cancel_replaced_fixed_reservations(t_id, p_client_id, v_old.combo_plan_id);
    end if;

    update public.client_subscriptions
       set combo_plan_id = p_combo_id, status = 'ACTIVE',
           fixed_weekday = p_weekday, fixed_start_min = p_start_min,
           fixed_barber_id = p_barber_id, fixed_service_id = v_service
     where id = sub_id;
  end if;

  perform public.ensure_fixed_reservations(p_client_id);
  return sub_id;
end $$;

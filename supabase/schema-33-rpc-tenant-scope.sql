-- ============================================================================
-- schema-33 — RPCs de cliente presas ao tenant de quem chama (P0 segurança). Idempotente.
--
-- Problema: is_admin() responde "o usuário é admin de ALGUMA barbearia", sem olhar
-- qual. As RPCs SECURITY DEFINER abaixo confiavam só nele, então o admin da
-- barbearia A conseguia mexer em cliente da barbearia B passando o p_client_id:
--   consume_cut, return_cut, assign_combo, activate_fixed_plan, add_fixed_makeup,
--   cancel_future_plan_appointments, ensure_fixed_reservations.
--
-- Correção: helper is_admin_of_client(cid) = is_admin() E o cliente pertence ao
-- auth_tenant_id() de quem chama. Cada função é recriada com o corpo da ÚLTIMA
-- versão aplicada (fontes indicadas em cada uma), trocando só a guarda.
--
-- MASTER: sem ramo global. O master só opera barbearia pelo modo "atuar como"
-- (cookie → header x-act-tenant), e auth_tenant_id() (schema-actas.sql) já devolve
-- o tenant escolhido para MASTER. Assim o master continua funcionando, mas só no
-- tenant em que está atuando.
--
-- Extras do mesmo padrão (triviais, ver PR):
--   * assign_combo deixa de aceitar owns_client (cliente podia recarregar o próprio saldo).
--   * activate_fixed_plan valida que barbeiro e serviço são do tenant do cliente.
--   * policies children_admin e wh_admin (WITH CHECK) passam a exigir o tenant.
--
-- Grants: CREATE OR REPLACE preserva a ACL atual de cada função (schema-21).
-- Rollback: reaplicar as versões anteriores (schema-21 consume_cut; schema-2
-- return_cut/assign_combo; schema-18 activate_fixed_plan; schema-fixed-plan
-- add_fixed_makeup/cancel_future_plan_appointments; schema-31
-- ensure_fixed_reservations; schema-children children_admin; schema.sql wh_admin).
-- ============================================================================

-- ---- Helper -----------------------------------------------------------------
create or replace function public.is_admin_of_client(cid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin()
     and exists (
       select 1 from public.clients c
        where c.id = cid and c.tenant_id = public.auth_tenant_id()
     )
$$;
revoke execute on function public.is_admin_of_client(uuid) from public, anon;
grant  execute on function public.is_admin_of_client(uuid) to authenticated, service_role;

-- ---- consume_cut (fonte: schema-21-security-hardening.sql) -------------------
create or replace function public.consume_cut(p_client_id uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare
  novo int;
begin
  if not (public.owns_client(p_client_id) or public.is_admin_of_client(p_client_id)) then
    raise exception 'forbidden';
  end if;

  update public.client_subscriptions
     set saldo_cortes = saldo_cortes - 1
   where client_id = p_client_id and status = 'ACTIVE' and saldo_cortes > 0
   returning saldo_cortes into novo;
  if novo is null then
    raise exception 'Sem saldo de cortes disponível';
  end if;
  return novo;
end $$;

-- ---- return_cut (fonte: schema-2.sql) ----------------------------------------
create or replace function public.return_cut(p_client_id uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare novo int;
begin
  if not (public.owns_client(p_client_id) or public.is_admin_of_client(p_client_id)) then
    raise exception 'forbidden';
  end if;
  update public.client_subscriptions
     set saldo_cortes = saldo_cortes + 1
   where client_id = p_client_id and status = 'ACTIVE'
   returning saldo_cortes into novo;
  return coalesce(novo, 0);
end $$;

-- ---- assign_combo (fonte: schema-2.sql) --------------------------------------
-- Só admin do tenant. Antes aceitava owns_client: o próprio cliente podia chamar e
-- zerar/recarregar o saldo com os cortes do combo. O app só chama pelo painel admin.
create or replace function public.assign_combo(p_client_id uuid, p_combo_plan_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare sub_id uuid; t_id uuid; v_cuts int;
begin
  if not public.is_admin_of_client(p_client_id) then
    raise exception 'forbidden';
  end if;
  select tenant_id into t_id from public.clients where id = p_client_id;
  select cuts into v_cuts from public.combo_plans where id = p_combo_plan_id and tenant_id = t_id;
  if v_cuts is null then raise exception 'combo inválido'; end if;

  select id into sub_id from public.client_subscriptions where client_id = p_client_id limit 1;
  if sub_id is null then
    insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, saldo_cortes, status)
    values (t_id, p_client_id, p_combo_plan_id, v_cuts, 'ACTIVE')
    returning id into sub_id;
  else
    update public.client_subscriptions
       set combo_plan_id = p_combo_plan_id, saldo_cortes = v_cuts, status = 'ACTIVE'
     where id = sub_id;
  end if;
  return sub_id;
end $$;

-- ---- activate_fixed_plan (fonte: schema-18.sql) ------------------------------
create or replace function public.activate_fixed_plan(
  p_client_id uuid, p_combo_id uuid, p_weekday int, p_start_min int, p_barber_id uuid, p_service_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare t_id uuid; sub_id uuid; v_mode text; v_service uuid;
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

  select id into sub_id from public.client_subscriptions where client_id = p_client_id limit 1;
  if sub_id is null then
    insert into public.client_subscriptions
      (tenant_id, client_id, combo_plan_id, saldo_cortes, status, fixed_weekday, fixed_start_min, fixed_barber_id, fixed_service_id)
    values (t_id, p_client_id, p_combo_id, 0, 'ACTIVE', p_weekday, p_start_min, p_barber_id, v_service)
    returning id into sub_id;
  else
    update public.client_subscriptions
       set combo_plan_id = p_combo_id, status = 'ACTIVE',
           fixed_weekday = p_weekday, fixed_start_min = p_start_min,
           fixed_barber_id = p_barber_id, fixed_service_id = v_service
     where id = sub_id;
  end if;

  perform public.ensure_fixed_reservations(p_client_id);
  return sub_id;
end $$;

-- ---- add_fixed_makeup (fonte: schema-fixed-plan.sql) -------------------------
create or replace function public.add_fixed_makeup(p_client_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_sub record; v_svc record; v_local timestamp; v_start timestamptz; v_appt uuid; v_guard int := 0;
begin
  if not public.is_admin_of_client(p_client_id) then raise exception 'forbidden'; end if;
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

-- ---- cancel_future_plan_appointments (fonte: schema-fixed-plan.sql) ----------
create or replace function public.cancel_future_plan_appointments(p_client_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin_of_client(p_client_id) then raise exception 'forbidden'; end if;
  update public.appointments set status = 'CANCELLED'
   where client_id = p_client_id and consumed_from_plan = true
     and start_at > now() and status in ('REQUESTED','CONFIRMED','ALT_OFFERED');
  get diagnostics n = row_count;
  return n;
end $$;

-- ---- ensure_fixed_reservations (fonte: schema-31-fixed-plan-debit.sql) -------
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
  if not (public.owns_client(p_client_id) or public.is_admin_of_client(p_client_id)) then
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

-- ---- Policies do mesmo padrão ------------------------------------------------
-- children (schema-children.sql): admin de qualquer barbearia lia/escrevia filhos
-- (nome, idade, foto) de clientes de todas. Dado de menor → LGPD.
drop policy if exists children_admin on public.children;
create policy children_admin on public.children
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin_of_client(client_id));

-- working_hours (schema.sql): o USING já filtrava o tenant, mas o WITH CHECK não,
-- então um admin podia INSERIR horário para barbeiro de outra barbearia.
drop policy if exists wh_admin on public.working_hours;
create policy wh_admin on public.working_hours
  for all using (public.is_admin() and exists (
    select 1 from public.barbers b where b.id = barber_id and b.tenant_id = public.auth_tenant_id()
  ))
  with check (public.is_admin() and exists (
    select 1 from public.barbers b where b.id = barber_id and b.tenant_id = public.auth_tenant_id()
  ));

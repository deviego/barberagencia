-- schema-55: iniciar atendimento da fila com confirmação de plano pela equipe (#100).
-- Aditiva e re-executável. Vale para QUALQUER senha (app, totem, balcão, fila rápida).
--
--   1. queue_entries.plan_confirmed_by / plan_confirmed_at: quem da equipe confirmou o plano na
--      cadeira e quando (nulos quando o atendimento é avulso).
--   2. _queue_plan_mode_allowed(modo): PONTO ÚNICO da regra do plano fixo (abaixo).
--      queue_plan_usable_clients(ids): para o painel mostrar "Usar plano" só a quem aceita.
--   3. start_queue_entry(p_entry_id, p_use_plan, p_barber_id, p_service_id): substitui os passos
--      soltos de startQueue (src/features/queue/actions.ts) por uma transação só:
--        - só equipe da barbearia da senha (admin da unidade ou acima: is_admin_of_client);
--        - senha em espera (WAITING); senha já iniciada devolve a comanda que existe e NÃO
--          desconta de novo;
--        - serviço e barbeiro escolhidos precisam ser da barbearia (e o barbeiro, ativo);
--        - avulso (p_use_plan = false): comanda com o serviço lançado, como hoje;
--        - "Usar plano" (p_use_plan = true): mesmo caminho da agenda (createAppointmentAdmin):
--          comanda com consumed_from_plan, combo_plan_id do plano e sem item avulso, e o corte
--          sai por consume_cut. Só plano por SALDO; plano FIXO é recusado (nesta fase o dono
--          segue com "Remover um corte", manual). Registra quem confirmou e quando.
--      Nenhuma senha desconta plano sozinha: só esta função, chamada pela equipe logada.
--      Erros (mensagem estável): QUEUE_FORBIDDEN, QUEUE_ENTRY_NOT_FOUND, QUEUE_ENTRY_NOT_WAITING,
--      QUEUE_SERVICE_NOT_IN_TENANT, QUEUE_BARBER_NOT_IN_TENANT, QUEUE_PLAN_NONE,
--      QUEUE_PLAN_FIXED, e o "Sem saldo de cortes disponível" de consume_cut.
--
-- Rollback (nesta ordem):
--   1. voltar startQueue para a versão em TS (sem RPC);
--   2. drop function if exists public.start_queue_entry(uuid, boolean, uuid, uuid);
--      drop function if exists public.queue_plan_usable_clients(uuid[]);
--      drop function if exists public._queue_plan_mode_allowed(text);
--   3. as duas colunas podem ficar (nulas). Não apagar: guardam quem confirmou planos já usados.

alter table public.queue_entries add column if not exists plan_confirmed_by uuid references auth.users(id) on delete set null;
alter table public.queue_entries add column if not exists plan_confirmed_at timestamptz;

-- PONTO ÚNICO da regra "plano fixo não usa 'Usar plano' na fila" (decisão do CTO, 20/11;
-- confirmação do Diego pendente). Para liberar o plano fixo, só esta função muda.
create or replace function public._queue_plan_mode_allowed(p_booking_mode text)
returns boolean language sql immutable set search_path = public as $$
  select p_booking_mode is distinct from 'FIXED'
$$;
revoke execute on function public._queue_plan_mode_allowed(text) from public, anon, authenticated;

-- Para o painel: dos clientes informados, quais aceitam "Usar plano" agora (plano ativo com
-- modo permitido e corte no saldo). Só devolve clientes da barbearia de quem pergunta.
create or replace function public.queue_plan_usable_clients(p_client_ids uuid[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.client_id
    from public.client_subscriptions s
    join public.combo_plans c on c.id = s.combo_plan_id
   where s.client_id = any(p_client_ids)
     and s.status = 'ACTIVE'
     and s.saldo_cortes > 0
     and public._queue_plan_mode_allowed(c.booking_mode)
     and public.is_admin_of_client(s.client_id)
$$;
revoke execute on function public.queue_plan_usable_clients(uuid[]) from public, anon;
grant execute on function public.queue_plan_usable_clients(uuid[]) to authenticated;

create or replace function public.start_queue_entry(
  p_entry_id   uuid,
  p_use_plan   boolean,
  p_barber_id  uuid,
  p_service_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry   public.queue_entries%rowtype;
  v_barber  uuid;
  v_service uuid;
  v_plan    record;
  v_svc     record;
  v_appt    uuid;
  v_now     timestamptz := now();
begin
  select * into v_entry from public.queue_entries where id = p_entry_id for update;
  if not found then
    raise exception 'QUEUE_ENTRY_NOT_FOUND';
  end if;
  -- Equipe da barbearia desta senha (a mesma conferência de consume_cut e cancel_client_plan).
  if not public.is_admin_of_client(v_entry.client_id) then
    raise exception 'QUEUE_FORBIDDEN';
  end if;

  -- Já iniciada: devolve a comanda existente, sem desconto novo (repetir não cobra duas vezes).
  if v_entry.status = 'IN_SERVICE' and v_entry.appointment_id is not null then
    return v_entry.appointment_id;
  end if;
  if v_entry.status <> 'WAITING' then
    raise exception 'QUEUE_ENTRY_NOT_WAITING';
  end if;

  v_service := coalesce(p_service_id, v_entry.service_id);
  v_barber  := coalesce(p_barber_id, v_entry.barber_id);
  if v_service is not null then
    select name, price_brl, duration_min into v_svc from public.services
     where id = v_service and tenant_id = v_entry.tenant_id;
    if not found then
      raise exception 'QUEUE_SERVICE_NOT_IN_TENANT';
    end if;
  end if;
  if v_barber is not null and not exists (
    select 1 from public.barbers b where b.id = v_barber and b.tenant_id = v_entry.tenant_id and b.active
  ) then
    raise exception 'QUEUE_BARBER_NOT_IN_TENANT';
  end if;

  if coalesce(p_use_plan, false) then
    select s.combo_plan_id, c.booking_mode into v_plan
      from public.client_subscriptions s
      join public.combo_plans c on c.id = s.combo_plan_id
     where s.client_id = v_entry.client_id and s.status = 'ACTIVE'
     limit 1;
    if not found then
      raise exception 'QUEUE_PLAN_NONE';
    end if;
    if not public._queue_plan_mode_allowed(v_plan.booking_mode) then
      raise exception 'QUEUE_PLAN_FIXED';
    end if;

    -- Caminho da agenda (createAppointmentAdmin com usePlan): sem serviço avulso na comanda.
    insert into public.appointments
      (tenant_id, client_id, barber_id, service_id, combo_plan_id, start_at, status,
       consumed_from_plan, service_started_at)
    values
      (v_entry.tenant_id, v_entry.client_id, v_barber, null, v_plan.combo_plan_id, v_now, 'CONFIRMED',
       true, v_now)
    returning id into v_appt;

    -- O corte sai do saldo pela função de sempre (confere a equipe e o saldo de novo).
    perform public.consume_cut(v_entry.client_id);
  else
    insert into public.appointments
      (tenant_id, client_id, barber_id, service_id, start_at, status, service_started_at)
    values
      (v_entry.tenant_id, v_entry.client_id, v_barber, v_service, v_now, 'CONFIRMED', v_now)
    returning id into v_appt;

    if v_service is not null then
      insert into public.appointment_items
        (appointment_id, tenant_id, kind, ref_id, name, price_brl, qty, duration_min, covered_by_plan)
      values
        (v_appt, v_entry.tenant_id, 'service', v_service, coalesce(v_svc.name, 'Serviço'),
         coalesce(v_svc.price_brl, 0), 1, coalesce(v_svc.duration_min, 0), false);
    end if;
  end if;

  update public.queue_entries
     set status            = 'IN_SERVICE',
         appointment_id    = v_appt,
         barber_id         = v_barber,
         service_id        = v_service,
         started_at        = v_now,
         called_at         = v_now,
         plan_confirmed_by = case when coalesce(p_use_plan, false) then auth.uid() end,
         plan_confirmed_at = case when coalesce(p_use_plan, false) then v_now end
   where id = v_entry.id;

  return v_appt;
end $$;

revoke execute on function public.start_queue_entry(uuid, boolean, uuid, uuid) from public, anon;
grant execute on function public.start_queue_entry(uuid, boolean, uuid, uuid) to authenticated;

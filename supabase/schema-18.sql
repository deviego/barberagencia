-- ============================================================================
-- Serviço no cadastro do plano fixo (não pedir serviço na aprovação). Idempotente.
--   - combo_plans.service_id (serviço que o plano reserva)
--   - backfill dos planos FIXED existentes com o melhor serviço correspondente
--   - activate_fixed_plan: serviço deixa de ser obrigatório (vem do plano)
-- ============================================================================

alter table public.combo_plans add column if not exists service_id uuid references public.services(id);

-- Backfill: para planos fixos sem serviço definido, escolhe o melhor serviço ativo
-- (nome igual > nome contido > mais barato).
update public.combo_plans p
   set service_id = (
     select s.id from public.services s
      where s.tenant_id = p.tenant_id and s.active = true
      order by (case
                  when lower(s.name) = lower(p.name) then 0
                  when p.name ilike '%' || s.name || '%' then 1
                  else 2
                end), s.price_brl
      limit 1
   )
 where p.booking_mode = 'FIXED' and p.service_id is null;

-- RPC: serviço agora é resolvido a partir do plano (param opcional).
create or replace function public.activate_fixed_plan(
  p_client_id uuid, p_combo_id uuid, p_weekday int, p_start_min int, p_barber_id uuid, p_service_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare t_id uuid; sub_id uuid; v_mode text; v_service uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select tenant_id into t_id from public.clients where id = p_client_id;
  select booking_mode into v_mode from public.combo_plans where id = p_combo_id and tenant_id = t_id;
  if v_mode is null then raise exception 'combo inválido'; end if;
  if v_mode <> 'FIXED' then raise exception 'combo não é de horário fixo'; end if;
  if p_weekday is null or p_start_min is null or p_barber_id is null then
    raise exception 'defina dia, horário e barbeiro';
  end if;

  -- Serviço vem do plano (ou do parâmetro, ou o 1º serviço ativo como último recurso).
  v_service := coalesce(
    p_service_id,
    (select service_id from public.combo_plans where id = p_combo_id),
    (select id from public.services where tenant_id = t_id and active = true order by price_brl limit 1)
  );
  if v_service is null then raise exception 'cadastre ao menos um serviço para ativar o plano'; end if;

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
grant execute on function public.activate_fixed_plan(uuid, uuid, int, int, uuid, uuid) to authenticated;

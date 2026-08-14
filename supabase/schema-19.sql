-- ============================================================================
-- Fila modo Totem (link secreto, cadastro por telefone, impressão). Idempotente.
--   - tenants.totem_token (segredo do totem)
--   - clients.birth_date
--   - tenant_settings.queue_mode ('TOTEM' | 'APP' | 'BOTH', default TOTEM)
--   - tenant_settings.queue_plan_requires_service (plano também escolhe serviço)
--   - join_queue_totem(): gera a senha do dia p/ um cliente (service-role only)
-- ============================================================================

alter table public.tenants add column if not exists totem_token text;
alter table public.clients add column if not exists birth_date date;
alter table public.tenant_settings add column if not exists queue_mode text not null default 'TOTEM'
  check (queue_mode in ('TOTEM','APP','BOTH'));
alter table public.tenant_settings add column if not exists queue_plan_requires_service boolean not null default false;

-- Gera token para tenants que ainda não têm (hex de 24 bytes).
update public.tenants set totem_token = encode(gen_random_bytes(24), 'hex') where totem_token is null;

-- ---- Entrar na fila pelo TOTEM (numeração diária atômica) --------------------
-- Sem checagem de auth: chamada apenas via service-role, DEPOIS de validar o token do totem
-- na server action. Por isso o EXECUTE é restrito ao service_role.
create or replace function public.join_queue_totem(
  p_tenant_id uuid, p_client_id uuid, p_service_id uuid, p_barber_id uuid
) returns public.queue_entries language plpgsql security definer set search_path = public as $$
declare
  v_day date := (timezone('America/Sao_Paulo', now()))::date;
  v_row public.queue_entries;
  v_ticket int;
begin
  -- Já está na fila hoje? retorna (atualizando serviço/barbeiro se informados).
  select * into v_row from public.queue_entries
   where tenant_id = p_tenant_id and client_id = p_client_id and day = v_day
     and status in ('WAITING','IN_SERVICE')
   order by joined_at limit 1;
  if found then
    update public.queue_entries
       set service_id = coalesce(p_service_id, service_id),
           barber_id  = coalesce(p_barber_id, barber_id)
     where id = v_row.id
     returning * into v_row;
    return v_row;
  end if;

  select coalesce(max(ticket_number), 0) + 1 into v_ticket
    from public.queue_entries where tenant_id = p_tenant_id and day = v_day;

  insert into public.queue_entries (tenant_id, client_id, ticket_number, service_id, barber_id, day)
  values (p_tenant_id, p_client_id, v_ticket, p_service_id, p_barber_id, v_day)
  returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.join_queue_totem(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_queue_totem(uuid, uuid, uuid, uuid) to service_role;

-- ---- Busca de cliente por telefone (dígitos) + info de plano (service-role) --
create or replace function public.totem_find_client(p_tenant uuid, p_digits text)
returns table(id uuid, name text, has_plan boolean, plan_name text)
language sql security definer set search_path = public as $$
  select c.id, c.name,
         exists(select 1 from public.client_subscriptions s where s.client_id = c.id and s.status = 'ACTIVE') as has_plan,
         (select cp.name from public.client_subscriptions s
             join public.combo_plans cp on cp.id = s.combo_plan_id
            where s.client_id = c.id and s.status = 'ACTIVE' limit 1) as plan_name
    from public.clients c
   where c.tenant_id = p_tenant
     and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = p_digits
   limit 1
$$;
revoke execute on function public.totem_find_client(uuid, text) from public, anon, authenticated;
grant execute on function public.totem_find_client(uuid, text) to service_role;

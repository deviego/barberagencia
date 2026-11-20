-- schema-61: regra de posse da senha da fila rápida (#98). Re-executável. Depende da schema-53.
--
-- A tela "Minha senha" (#98) e o "Sair da fila" só valem para a senha cujo device_id é o do
-- aparelho que pergunta. Quando OUTRO caminho devolve uma senha que já existe para o cliente
-- (fila pelo app com login, totem/balcão), aquela senha passa a ser desse caminho: o device_id
-- da linha é zerado e o aparelho da fila rápida deixa de vê-la e de poder cancelá-la.
--
-- Muda só o ramo "já está na fila hoje" das duas funções abaixo; assinatura, retorno,
-- conferências e numeração ficam iguais às versões em vigor:
--   join_queue(uuid, uuid, uuid)              cópia da schema-16 (security definer: o update do
--                                             device_id não passa pela RLS do cliente logado)
--   join_queue_totem(uuid, uuid, uuid, uuid)  cópia da schema-50
-- create or replace mantém as permissões em vigor; os grants abaixo são os mesmos das origens.
--
-- Rollback: reaplicar o bloco de join_queue da schema-16 e o de join_queue_totem da schema-50.

-- Fila pelo app (cliente logado) ---------------------------------------------------------------
create or replace function public.join_queue(p_tenant_id uuid, p_service_id uuid, p_barber_id uuid)
returns public.queue_entries language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_day date := (timezone('America/Sao_Paulo', now()))::date;
  v_row public.queue_entries;
  v_ticket int;
begin
  select id into v_client from public.clients
   where user_id = auth.uid() and tenant_id = p_tenant_id
   limit 1;
  if v_client is null then raise exception 'cliente não encontrado nesta barbearia'; end if;

  -- Já está na fila hoje? retorna (atualizando serviço/barbeiro se informados). A senha passa a
  -- ser deste caminho: device_id zerado (regra de posse, #98).
  select * into v_row from public.queue_entries
   where tenant_id = p_tenant_id and client_id = v_client and day = v_day
     and status in ('WAITING','IN_SERVICE')
   order by joined_at limit 1;
  if found then
    update public.queue_entries
       set service_id = coalesce(p_service_id, service_id),
           barber_id  = coalesce(p_barber_id, barber_id),
           device_id  = null
     where id = v_row.id
     returning * into v_row;
    return v_row;
  end if;

  -- Próxima senha do dia.
  select coalesce(max(ticket_number), 0) + 1 into v_ticket
    from public.queue_entries where tenant_id = p_tenant_id and day = v_day;

  insert into public.queue_entries (tenant_id, client_id, ticket_number, service_id, barber_id, day)
  values (p_tenant_id, v_client, v_ticket, p_service_id, p_barber_id, v_day)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.join_queue(uuid, uuid, uuid) to authenticated;

-- Totem / balcão --------------------------------------------------------------------------------
create or replace function public.join_queue_totem(
  p_tenant_id uuid, p_client_id uuid, p_service_id uuid, p_barber_id uuid
) returns public.queue_entries language plpgsql security definer set search_path = public as $$
declare
  v_day date := (timezone('America/Sao_Paulo', now()))::date;
  v_row public.queue_entries;
  v_ticket int;
begin
  if p_tenant_id is null or p_client_id is null or not exists (
    select 1 from public.clients c where c.id = p_client_id and c.tenant_id = p_tenant_id
  ) then
    raise exception 'TOTEM_CLIENT_NOT_IN_TENANT';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services s
     where s.id = p_service_id and s.tenant_id = p_tenant_id and s.active
  ) then
    raise exception 'TOTEM_SERVICE_NOT_IN_TENANT';
  end if;
  if p_barber_id is not null and not exists (
    select 1 from public.barbers b
     where b.id = p_barber_id and b.tenant_id = p_tenant_id and b.active and b.accepts_queue
  ) then
    raise exception 'TOTEM_BARBER_NOT_IN_TENANT';
  end if;

  -- Uma senha por vez por barbearia + dia: pedidos simultâneos esperam em vez de falhar.
  perform pg_advisory_xact_lock(hashtextextended('queue_ticket:' || p_tenant_id::text || ':' || v_day::text, 0));

  -- Já está na fila hoje? retorna (atualizando serviço/barbeiro se informados). A senha passa a
  -- ser deste caminho: device_id zerado (regra de posse, #98).
  select * into v_row from public.queue_entries
   where tenant_id = p_tenant_id and client_id = p_client_id and day = v_day
     and status in ('WAITING','IN_SERVICE')
   order by joined_at limit 1;
  if found then
    update public.queue_entries
       set service_id = coalesce(p_service_id, service_id),
           barber_id  = coalesce(p_barber_id, barber_id),
           device_id  = null
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

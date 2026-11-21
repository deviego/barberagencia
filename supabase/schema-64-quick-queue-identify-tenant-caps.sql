-- schema-64: tetos por barbearia da identificação da fila rápida com resultado próprio (#148).
-- Re-executável. Pedido da revisão de segurança do #152, obrigatório antes de barbearia real.
--
--   1. quick_queue_identify: mesma assinatura, mesma lógica e mesmas permissões da schema-52;
--      muda SÓ o resultado quando um teto POR BARBEARIA barra:
--        TENANT_ATTEMPTS     tentativas da barbearia na janela (antes vinha junto com o
--                            limite por aparelho, como LIMIT)
--        TENANT_NEW_DEVICES  credenciais novas da barbearia na última hora (antes LIMIT)
--        TENANT_NEW_CLIENTS  contas novas pela fila rápida no dia (antes LIMIT)
--      Limites por aparelho e por cliente continuam LIMIT. O aviso ao cliente é o mesmo em todos.
--   2. quick_queue_limit_daily aceita os tipos novos (IDENTIFY_TENANT, NEW_DEVICES_TENANT,
--      NEW_CLIENTS_TENANT), que ligam o alerta ao dono (tenantCapHit) como TENANT_ACTIVE.
--
-- Ordem: aplicar DEPOIS do deploy do código deste PR (que entende os resultados antigos e os
-- novos). Com o código anterior, os resultados novos virariam o erro genérico na tela.
--
-- Rollback: reaplicar o bloco de quick_queue_identify da schema-52 e
--   alter table public.quick_queue_limit_daily drop constraint if exists quick_queue_limit_daily_kind_check;
--   alter table public.quick_queue_limit_daily add constraint quick_queue_limit_daily_kind_check
--     check (kind in ('IDENTIFY','JOIN_RATE','PHONE_BUSY','DEVICE_ACTIVE','TENANT_ACTIVE'));
--   O check antigo só volta se ainda não houver linha com tipo novo. Se houver, manter o check
--   novo (nenhuma linha é apagada).

-- 1) Identificação com resultado próprio para os tetos da barbearia -----------------------------
create or replace function public.quick_queue_identify(
  p_tenant_id              uuid,
  p_device_hash            text,  -- resumo da credencial atual (null se o aparelho não tem)
  p_new_device_hash        text,  -- resumo de uma credencial nova gerada pelo servidor (null = não emitir)
  p_phone_key              text,  -- passo do telefone; null no passo do nome
  p_name                   text,  -- passo do nome; null no passo do telefone
  p_window_seconds         int,
  p_per_device             int,
  p_per_client             int,
  p_per_tenant             int,
  p_new_devices_hour       int,
  p_new_clients_day        int,
  p_device_ttl_days        int,
  p_pending_minutes        int
)
returns table (result text, new_device boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now      timestamptz := now();
  v_since    timestamptz := now() - make_interval(secs => p_window_seconds);
  v_dev      public.quick_queue_devices%rowtype;
  v_new      boolean := false;
  v_key      text;
  v_client   uuid;
  v_name     text;
  v_day      date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- Uma identificação por vez por barbearia: contagens e criação sem corrida.
  perform pg_advisory_xact_lock(hashtextextended('quick_queue:' || p_tenant_id::text, 0));

  -- Telefone deixado no passo do nome que já venceu: some. Antes de qualquer outra checagem,
  -- para limpar mesmo com a fila rápida desligada. (Barbearia sem nenhuma chamada: rotina da #108.)
  update public.quick_queue_devices
     set pending_phone_key = null, pending_until = null
   where tenant_id = p_tenant_id and pending_until is not null and pending_until <= v_now;

  if not exists (
    select 1 from public.tenants t
     where t.id = p_tenant_id and t.quick_queue_enabled and coalesce(t.kind, 'BARBERSHOP') = 'BARBERSHOP'
  ) then
    return query select 'CLOSED'::text, false; return;
  end if;

  if (p_phone_key is null) = (p_name is null) then
    return query select 'INVALID'::text, false; return;
  end if;

  -- Credencial: vale só nesta barbearia e dentro da validade.
  if p_device_hash is not null then
    select * into v_dev from public.quick_queue_devices
     where tenant_id = p_tenant_id and token_hash = p_device_hash and expires_at > v_now
     for update;
  end if;

  if v_dev.id is null then
    if p_new_device_hash is null or p_phone_key is null then
      return query select 'NO_PENDING'::text, false; return;
    end if;
    if (select count(*) from public.quick_queue_devices
         where tenant_id = p_tenant_id and created_at > v_now - interval '1 hour') >= p_new_devices_hour then
      return query select 'TENANT_NEW_DEVICES'::text, false; return;
    end if;
    insert into public.quick_queue_devices (tenant_id, token_hash, expires_at)
    values (p_tenant_id, p_new_device_hash, v_now + make_interval(days => p_device_ttl_days))
    returning * into v_dev;
    v_new := true;
  else
    update public.quick_queue_devices
       set last_used_at = v_now, expires_at = v_now + make_interval(days => p_device_ttl_days)
     where id = v_dev.id;
  end if;

  -- Tentativas por aparelho (LIMIT) e teto por barbearia (TENANT_ATTEMPTS), separados (#148).
  if (select count(*) from public.quick_queue_identify_attempts
       where device_id = v_dev.id and created_at > v_since) >= p_per_device then
    return query select 'LIMIT'::text, v_new; return;
  end if;
  if (select count(*) from public.quick_queue_identify_attempts
       where tenant_id = p_tenant_id and created_at > v_since) >= p_per_tenant then
    return query select 'TENANT_ATTEMPTS'::text, v_new; return;
  end if;

  -- Telefone do passo atual ou o deixado pelo passo do telefone.
  if p_phone_key is not null then
    v_key := p_phone_key;
  else
    v_key := v_dev.pending_phone_key;
    if v_key is null then
      return query select 'NO_PENDING'::text, v_new; return;
    end if;
  end if;
  if public.br_phone_key(v_key) is distinct from v_key then
    return query select 'INVALID'::text, v_new; return;
  end if;

  -- Cliente desta barbearia com essa chave (ou ficha antiga sem chave com o mesmo telefone).
  select id into v_client from public.clients
   where tenant_id = p_tenant_id and phone_key = v_key;
  if v_client is null then
    select id into v_client from public.clients
     where tenant_id = p_tenant_id and phone_key is null and public.br_phone_key(phone) = v_key
     order by created_at, id limit 1;
    if v_client is not null then
      update public.clients set phone_key = v_key where id = v_client;
    end if;
  end if;

  if v_client is not null then
    if (select count(*) from public.quick_queue_identify_attempts
         where tenant_id = p_tenant_id and client_id = v_client and created_at > v_since) >= p_per_client then
      return query select 'LIMIT'::text, v_new; return;
    end if;
    insert into public.quick_queue_identify_attempts (tenant_id, device_id, client_id)
    values (p_tenant_id, v_dev.id, v_client);
    update public.quick_queue_devices
       set client_id = v_client, pending_phone_key = null, pending_until = null
     where id = v_dev.id;
    return query select 'KNOWN'::text, v_new; return;
  end if;

  insert into public.quick_queue_identify_attempts (tenant_id, device_id, client_id)
  values (p_tenant_id, v_dev.id, null);

  if p_name is null then
    update public.quick_queue_devices
       set client_id = null, pending_phone_key = v_key,
           pending_until = v_now + make_interval(mins => p_pending_minutes)
     where id = v_dev.id;
    return query select 'NEED_NAME'::text, v_new; return;
  end if;

  v_name := btrim(p_name);
  if char_length(v_name) < 2 or char_length(v_name) > 60 or v_name ~ '[0-9<>/:@]' then
    return query select 'INVALID'::text, v_new; return;
  end if;

  if (select count(*) from public.clients
       where tenant_id = p_tenant_id and signup_origin = 'QUICK_QUEUE'
         and (created_at at time zone 'America/Sao_Paulo')::date = v_day) >= p_new_clients_day then
    return query select 'TENANT_NEW_CLIENTS'::text, v_new; return;
  end if;

  insert into public.clients (tenant_id, name, phone, phone_key, signup_origin)
  values (
    p_tenant_id, v_name,
    case when length(v_key) = 11
      then '(' || substr(v_key, 1, 2) || ') ' || substr(v_key, 3, 5) || '-' || substr(v_key, 8)
      else '(' || substr(v_key, 1, 2) || ') ' || substr(v_key, 3, 4) || '-' || substr(v_key, 7)
    end,
    v_key, 'QUICK_QUEUE'
  )
  returning id into v_client;

  update public.quick_queue_devices
     set client_id = v_client, pending_phone_key = null, pending_until = null
   where id = v_dev.id;
  return query select 'CREATED'::text, v_new;
end;
$$;

revoke all on function public.quick_queue_identify(uuid, text, text, text, text, int, int, int, int, int, int, int, int)
  from public, anon, authenticated;
grant execute on function public.quick_queue_identify(uuid, text, text, text, text, int, int, int, int, int, int, int, int)
  to service_role;

-- 2) Tipos novos na contagem do dia ---------------------------------------------------------------
alter table public.quick_queue_limit_daily drop constraint if exists quick_queue_limit_daily_kind_check;
alter table public.quick_queue_limit_daily add constraint quick_queue_limit_daily_kind_check
  check (kind in ('IDENTIFY', 'JOIN_RATE', 'PHONE_BUSY', 'DEVICE_ACTIVE', 'TENANT_ACTIVE',
                  'IDENTIFY_TENANT', 'NEW_DEVICES_TENANT', 'NEW_CLIENTS_TENANT'));

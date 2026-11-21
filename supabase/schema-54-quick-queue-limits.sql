-- schema-54: travas de uso da fila rápida (#99). Aditiva e re-executável. Depende da schema-53.
--
--   0. Conferência: se já houver cliente com duas senhas ativas no mesmo dia na mesma barbearia,
--      a migration PARA aqui sem mudar nada (o índice único do passo 1 não poderia ser criado).
--      Consulta para rodar antes, no SQL editor:
--        select tenant_id, client_id, day, count(*) from public.queue_entries
--         where status in ('WAITING','IN_SERVICE')
--         group by 1, 2, 3 having count(*) > 1;
--   1. Regra do banco "1 senha ativa por cliente por barbearia por dia", para QUALQUER origem
--      (fila pelo app, totem, balcão e fila rápida): índice único parcial em queue_entries.
--   2. quick_queue_limit_daily: contagem do dia de limites estourados por barbearia e tipo, para
--      o alerta ao dono no painel. Sem telefone, sem aparelho, sem cliente: só barbearia, dia,
--      tipo e quantas vezes. Uma linha por barbearia + dia + tipo (não cresce com o abuso).
--      quick_queue_record_limit(): soma 1 (service_role; a identificação da #96 registra por ela).
--   3. quick_queue_join() com as travas, conferidas dentro da função e na mesma transação:
--        - plano com fila e modo da fila que aceita o link (mesma regra do guard em
--          src/features/quick-queue/rules.ts; nit da revisão do #143);
--        - 10 pedidos por aparelho a cada 10 min (valores vêm de src/features/quick-queue/limits.ts);
--        - 1 senha ativa por telefone hoje, contando totem e balcão: a do próprio aparelho volta
--          como EXISTING (antes de conferir serviço e preço; nit do #143); a tirada por outro
--          caminho volta como PHONE_BUSY, sem número nem posição;
--        - 2 senhas ativas por aparelho; teto de senhas ativas da fila rápida por barbearia
--          (totem e balcão não entram nessa conta);
--        - renova a validade da credencial no banco a cada senha (regra de 30 dias; nit do #143).
--      Substitui a versão de 5 parâmetros da schema-53 (removida aqui).
--   4. Parte da #98 (a #98 não tem migration própria): queue_entries.left_by_client, o mínimo
--      para a tela "Minha senha" distinguir "cancelada pelo cliente" (true) de "removida pela
--      barbearia" (nulo). Só a ação de sair da fila rápida grava true.
--
-- Rollback (nesta ordem):
--   1. voltar o código de joinQuickQueue para a chamada de 5 parâmetros;
--   2. reaplicar o bloco de quick_queue_join da schema-53 e
--      drop function if exists public.quick_queue_join(uuid, text, uuid, int, uuid, int, int, int, int, int);
--   3. drop function if exists public.quick_queue_record_limit(uuid, text);
--      drop table if exists public.quick_queue_limit_daily;   (só contagens técnicas)
--   4. drop index if exists public.uq_queue_active_client_day;
--   5. left_by_client pode ficar (nula nas outras origens). Não apagar.

-- 0) Conferência --------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.queue_entries
     where status in ('WAITING', 'IN_SERVICE')
     group by tenant_id, client_id, day having count(*) > 1
  ) then
    raise exception 'QQ54_DUPLICATE_ACTIVE: há cliente com duas senhas ativas no mesmo dia; rode a consulta do cabeçalho e resolva antes';
  end if;
end $$;

-- 1) Uma senha ativa por cliente por barbearia por dia -------------------------------------------
create unique index if not exists uq_queue_active_client_day
  on public.queue_entries (tenant_id, client_id, day)
  where status in ('WAITING', 'IN_SERVICE');

-- 4) (#98) quem tirou a senha -------------------------------------------------------------------
alter table public.queue_entries add column if not exists left_by_client boolean;

-- 2) Contagem do dia de limites estourados -------------------------------------------------------
create table if not exists public.quick_queue_limit_daily (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  day       date not null,
  kind      text not null check (kind in ('IDENTIFY', 'JOIN_RATE', 'PHONE_BUSY', 'DEVICE_ACTIVE', 'TENANT_ACTIVE')),
  hits      int  not null default 0,
  last_at   timestamptz not null default now(),
  primary key (tenant_id, day, kind)
);
alter table public.quick_queue_limit_daily enable row level security;
revoke all on public.quick_queue_limit_daily from anon, authenticated;
grant select on public.quick_queue_limit_daily to authenticated;
grant select, insert, update on public.quick_queue_limit_daily to service_role;

-- Dono/gerente da barbearia lê a contagem da própria barbearia (mesma regra de qe_admin).
drop policy if exists qq_limit_daily_admin_read on public.quick_queue_limit_daily;
create policy qq_limit_daily_admin_read on public.quick_queue_limit_daily
  for select using (tenant_id = public.auth_tenant_id() and public.is_admin());

create or replace function public.quick_queue_record_limit(p_tenant_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null or p_kind is null then return; end if;
  insert into public.quick_queue_limit_daily (tenant_id, day, kind, hits, last_at)
  values (p_tenant_id, (timezone('America/Sao_Paulo', now()))::date, p_kind, 1, now())
  on conflict (tenant_id, day, kind)
  do update set hits = public.quick_queue_limit_daily.hits + 1, last_at = excluded.last_at;
end $$;
revoke execute on function public.quick_queue_record_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.quick_queue_record_limit(uuid, text) to service_role;

-- 3) Entrar na fila com as travas ----------------------------------------------------------------
drop function if exists public.quick_queue_join(uuid, text, uuid, int, uuid);

create or replace function public.quick_queue_join(
  p_tenant_id         uuid,
  p_device_hash       text,
  p_service_id        uuid,
  p_price_cents       int,
  p_barber_id         uuid,
  p_window_seconds    int,
  p_join_per_device   int,
  p_active_per_device int,
  p_tenant_active_cap int,
  p_device_ttl_days   int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day      date := (timezone('America/Sao_Paulo', now()))::date;
  v_dev      public.quick_queue_devices%rowtype;
  v_key      text;
  v_own      boolean;
  v_ticket   int;
  v_con      text;
begin
  if p_tenant_id is null or p_service_id is null or p_price_cents is null
     or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$'
     or coalesce(p_window_seconds, 0) < 1 or coalesce(p_join_per_device, 0) < 1
     or coalesce(p_active_per_device, 0) < 1 or coalesce(p_tenant_active_cap, 0) < 1
     or coalesce(p_device_ttl_days, 0) < 1 then
    return 'INVALID';
  end if;

  -- Mesma regra do guard (rules.ts → quickQueueStatus): barbearia, fila e fila rápida ligadas,
  -- plano com fila (no teste tudo vale; depois do teste o Personal não tem fila) e modo que
  -- aceita o link (só totem não aceita; sem linha de configuração vale APP).
  if not exists (
    select 1 from public.tenants t
      left join public.tenant_contracts tc on tc.tenant_id = t.id
      left join public.tenant_settings ts on ts.tenant_id = t.id
     where t.id = p_tenant_id and t.queue_enabled and t.quick_queue_enabled
       and coalesce(t.kind, 'BARBERSHOP') = 'BARBERSHOP'
       and (t.saas_plan is distinct from 'personal' or tc.trial_ends_at is null or tc.trial_ends_at > now())
       and coalesce(ts.queue_mode, 'APP') <> 'TOTEM'
  ) then
    return 'CLOSED';
  end if;

  select d.* into v_dev from public.quick_queue_devices d
    join public.clients c on c.id = d.client_id and c.tenant_id = p_tenant_id
   where d.tenant_id = p_tenant_id and d.token_hash = p_device_hash and d.expires_at > now();
  if not found then
    return 'NO_CLIENT';
  end if;

  -- Pedidos por aparelho na janela (armazenamento da schema-50; limpeza da schema-60).
  if not public.rate_limit_hit('qq_join', v_dev.id::text, p_window_seconds, p_join_per_device) then
    perform public.quick_queue_record_limit(p_tenant_id, 'JOIN_RATE');
    return 'RATE_LIMIT';
  end if;

  -- Mesma trava de join_queue_totem: uma senha por vez por barbearia + dia.
  perform pg_advisory_xact_lock(hashtextextended('queue_ticket:' || p_tenant_id::text || ':' || v_day::text, 0));

  -- 1 senha ativa por telefone hoje, de qualquer origem. Telefone igual em outro cadastro da
  -- mesma barbearia também conta (cadastros repetidos antigos ficam sem phone_key).
  select public.br_phone_key(c.phone) into v_key from public.clients c where c.id = v_dev.client_id;
  select bool_or(e.device_id is not distinct from v_dev.id and e.client_id = v_dev.client_id) into v_own
    from public.queue_entries e
    join public.clients c2 on c2.id = e.client_id
   where e.tenant_id = p_tenant_id and e.day = v_day and e.status in ('WAITING', 'IN_SERVICE')
     and (e.client_id = v_dev.client_id or (v_key is not null and public.br_phone_key(c2.phone) = v_key));
  if v_own is not null then
    if v_own then
      update public.quick_queue_devices
         set last_used_at = now(), expires_at = now() + make_interval(days => p_device_ttl_days)
       where id = v_dev.id;
      return 'EXISTING';
    end if;
    perform public.quick_queue_record_limit(p_tenant_id, 'PHONE_BUSY');
    return 'PHONE_BUSY';
  end if;

  if not exists (
    select 1 from public.services s
     where s.id = p_service_id and s.tenant_id = p_tenant_id and s.active
       and round(s.price_brl * 100)::int = p_price_cents
  ) then
    return 'SERVICE_CHANGED';
  end if;

  if p_barber_id is not null and not exists (
    select 1 from public.barbers b
      join public.tenant_settings ts on ts.tenant_id = b.tenant_id and ts.queue_pick_barber
     where b.id = p_barber_id and b.tenant_id = p_tenant_id and b.active and b.accepts_queue
  ) then
    return 'SERVICE_CHANGED';
  end if;

  if (select count(*) from public.queue_entries
       where tenant_id = p_tenant_id and day = v_day and device_id = v_dev.id
         and status in ('WAITING', 'IN_SERVICE')) >= p_active_per_device then
    perform public.quick_queue_record_limit(p_tenant_id, 'DEVICE_ACTIVE');
    return 'DEVICE_LIMIT';
  end if;

  if (select count(*) from public.queue_entries
       where tenant_id = p_tenant_id and day = v_day and source = 'QUICK_QUEUE'
         and status in ('WAITING', 'IN_SERVICE')) >= p_tenant_active_cap then
    perform public.quick_queue_record_limit(p_tenant_id, 'TENANT_ACTIVE');
    return 'TENANT_CAP';
  end if;

  select coalesce(max(ticket_number), 0) + 1 into v_ticket
    from public.queue_entries where tenant_id = p_tenant_id and day = v_day;

  begin
    insert into public.queue_entries
      (tenant_id, client_id, ticket_number, service_id, barber_id, day, source, phone_verified, device_id)
    values
      (p_tenant_id, v_dev.client_id, v_ticket, p_service_id, p_barber_id, v_day, 'QUICK_QUEUE', false, v_dev.id);
  exception when unique_violation then
    -- A fila pelo app (join_queue) não usa a trava: se ela gravou senha para o mesmo cliente no
    -- mesmo instante, a regra do banco segura e a resposta é neutra. Outro índice: erro normal.
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'uq_queue_active_client_day' then
      perform public.quick_queue_record_limit(p_tenant_id, 'PHONE_BUSY');
      return 'PHONE_BUSY';
    end if;
    raise;
  end;

  update public.quick_queue_devices
     set last_used_at = now(), expires_at = now() + make_interval(days => p_device_ttl_days)
   where id = v_dev.id;
  return 'OK';
end $$;

revoke execute on function public.quick_queue_join(uuid, text, uuid, int, uuid, int, int, int, int, int)
  from public, anon, authenticated;
grant execute on function public.quick_queue_join(uuid, text, uuid, int, uuid, int, int, int, int, int)
  to service_role;

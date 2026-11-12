-- schema-50: validações do totem no servidor. Idempotente e aditiva (pode rodar mais de uma vez).
--
--   1. rate_limit_events + rate_limit_hit(): armazenamento genérico de limite de tentativas
--      (mesmo padrão do schema-35: hash de IP com sal do servidor, nunca o IP cru).
--   2. join_queue_totem(): mesma assinatura e mesmo retorno; passa a conferir que cliente,
--      serviço e barbeiro são da barbearia informada (serviço ativo; barbeiro ativo e que
--      atende fila) e numera as senhas com bloqueio por barbearia + dia.
--   3. totem_resolve_client_id(): regra única (e ordenada) para achar o cliente pelo telefone.
--   4. totem_lookup_client(): busca do totem com as colunas que a tela usa (sem id), pela
--      mesma regra. totem_find_client() NÃO muda.
--
-- Segurança:
--   * rate_limit_events: RLS ligada e NENHUMA policy; grants revogados de anon/authenticated.
--   * As quatro funções: execute só para service_role.
--   * rate_limit_events não guarda dado pessoal: escopo, chave (hash) e horário.
--
-- Rollback:
--   drop function if exists public.totem_lookup_client(uuid, text);
--   drop function if exists public.totem_resolve_client_id(uuid, text);
--   drop function if exists public.rate_limit_hit(text, text, int, int);
--   drop table if exists public.rate_limit_events;
--   join_queue_totem: reaplicar o bloco da função em supabase/schema-19.sql.

-- ---- 1. Limite de tentativas (genérico) --------------------------------------
create table if not exists public.rate_limit_events (
  id         bigint generated always as identity primary key,
  scope      text not null check (char_length(scope) between 1 and 40),
  key        text not null check (char_length(key) between 1 and 128),
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_scope_key_created_idx
  on public.rate_limit_events (scope, key, created_at);

alter table public.rate_limit_events enable row level security;
-- Sem policies de propósito: nenhum acesso via PostgREST para anon/authenticated.
revoke all on table public.rate_limit_events from anon, authenticated;
-- Explícito, para não depender dos privilégios padrão do projeto.
grant select, insert on table public.rate_limit_events to service_role;

-- Conta as tentativas aceitas de (escopo, chave) na janela e, se couber mais uma, registra.
-- true = liberado (e registrado); false = acima do limite (nada é gravado).
-- O lock por (escopo, chave) evita que chamadas simultâneas passem juntas do limite.
create or replace function public.rate_limit_hit(
  p_scope text, p_key text, p_window_seconds int, p_limit int
) returns boolean language plpgsql set search_path = public as $$
declare
  v_now timestamptz;
  v_count int;
begin
  if p_scope is null or p_key is null
     or p_window_seconds is null or p_window_seconds < 1
     or p_limit is null or p_limit < 1 then
    raise exception 'RATE_LIMIT_INVALID_ARGS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_key, 0));
  v_now := clock_timestamp();

  select count(*) into v_count
    from public.rate_limit_events
   where scope = p_scope and key = p_key
     and created_at > v_now - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then return false; end if;

  insert into public.rate_limit_events (scope, key, created_at) values (p_scope, p_key, v_now);
  return true;
end $$;

revoke execute on function public.rate_limit_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, int, int) to service_role;

-- ---- 2. Entrar na fila pelo totem: confere a barbearia de cada id -------------
-- Mesma assinatura e mesmo retorno do schema-19. Erros com código estável na mensagem:
--   TOTEM_CLIENT_NOT_IN_TENANT  cliente não é da barbearia
--   TOTEM_SERVICE_NOT_IN_TENANT serviço não é da barbearia ou está inativo
--   TOTEM_BARBER_NOT_IN_TENANT  barbeiro não é da barbearia, está inativo ou não atende fila
-- (os mesmos filtros da lista mostrada no totem)
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

-- ---- 3. Regra única para achar o cliente pelo telefone ----------------------
-- Telefone repetido na mesma barbearia: vale sempre o cadastro mais antigo (desempate por id).
-- A busca (abaixo) e a geração da senha (server action) usam esta mesma função.
create or replace function public.totem_resolve_client_id(p_tenant uuid, p_digits text)
returns uuid language sql stable security definer set search_path = public as $$
  select c.id
    from public.clients c
   where c.tenant_id = p_tenant
     and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = p_digits
   order by c.created_at, c.id
   limit 1
$$;
revoke execute on function public.totem_resolve_client_id(uuid, text) from public, anon, authenticated;
grant execute on function public.totem_resolve_client_id(uuid, text) to service_role;

-- ---- 4. Busca do totem: só o que a tela usa ----------------------------------
-- Mesmas colunas de totem_find_client (schema-19), sem a coluna id.
create or replace function public.totem_lookup_client(p_tenant uuid, p_digits text)
returns table(name text, has_plan boolean, plan_name text)
language sql stable security definer set search_path = public as $$
  select c.name,
         exists(select 1 from public.client_subscriptions s where s.client_id = c.id and s.status = 'ACTIVE') as has_plan,
         (select cp.name from public.client_subscriptions s
             join public.combo_plans cp on cp.id = s.combo_plan_id
            where s.client_id = c.id and s.status = 'ACTIVE' limit 1) as plan_name
    from public.clients c
   where c.id = public.totem_resolve_client_id(p_tenant, p_digits)
$$;
revoke execute on function public.totem_lookup_client(uuid, text) from public, anon, authenticated;
grant execute on function public.totem_lookup_client(uuid, text) to service_role;

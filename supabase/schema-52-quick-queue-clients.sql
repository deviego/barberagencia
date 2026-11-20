-- schema-52: fila rápida — identificação por telefone e nome (story #96).
-- Aditiva e idempotente (pode rodar mais de uma vez). Compatível com o código em produção.
--
-- O que entra:
--   * public.br_phone_key(text): a regra ÚNICA de telefone (igual a src/lib/phone.ts).
--   * clients.phone_key + índice único parcial (tenant_id, phone_key): um cliente por telefone
--     por barbearia, garantido no banco. Preenchimento inicial só onde não há repetição;
--     nos repetidos, só o cadastro mais antigo recebe a chave. Nenhum cliente é apagado ou juntado.
--   * clients.signup_origin ('QUICK_QUEUE') e clients.phone_verified_at (nulas).
--   * gatilho que mantém phone_key igual ao telefone e impede visitante/usuário comum de
--     escrever phone_key, signup_origin ou phone_verified_at.
--   * public.quick_queue_devices: credencial do aparelho (só o resumo sha256 do valor do cookie).
--   * public.quick_queue_identify_attempts: tentativas de identificação, sem telefone.
--   * public.quick_queue_identify(...): RPC só do service_role.
--
-- Segurança:
--   * Tabelas novas com RLS ligada e NENHUMA policy; grants revogados de anon/authenticated.
--   * A RPC trava por barbearia (pg_advisory_xact_lock) antes de contar e criar: dois envios
--     ao mesmo tempo geram um cliente só; os limites valem para pedido direto ao servidor.
--   * Telefone não vai para tentativa nem para log. O telefone novo fica no aparelho só entre o
--     passo do telefone e o do nome (até 10 min) e é apagado ao usar ou na próxima chamada.
--
-- ANTES de aplicar em produção (Diego): rodar a conferência abaixo. Só mostra contagens.
--   select count(*) as barbearias_com_repeticao, coalesce(sum(n - 1), 0) as cadastros_sem_chave
--     from (select tenant_id, public.br_phone_key(phone) k, count(*) n
--             from public.clients where public.br_phone_key(phone) is not null
--            group by 1, 2 having count(*) > 1) r;
--   (a função precisa existir: rode só o bloco 1 abaixo antes, ou leia o resultado depois)
--
-- Rollback (só antes de qualquer conta criada pela fila rápida):
--   drop function if exists public.quick_queue_identify(uuid, text, text, text, text, int, int, int, int, int, int, int, int);
--   drop table if exists public.quick_queue_identify_attempts;
--   drop table if exists public.quick_queue_devices;
--   drop trigger if exists clients_phone_key_sync on public.clients;
--   drop function if exists public.clients_phone_key_sync();
--   drop index if exists public.uq_clients_tenant_phone_key;
--   alter table public.clients drop column if exists phone_key,
--     drop column if exists signup_origin, drop column if exists phone_verified_at;
--   drop function if exists public.br_phone_key(text);

-- 1) Regra única de telefone --------------------------------------------------
create or replace function public.br_phone_key(p text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(coalesce(p, '')) > 40 then return null; end if;
  if length(d) in (12, 13) and left(d, 2) = '55' then d := substr(d, 3); end if;
  if length(d) in (11, 12) and left(d, 1) = '0' then d := substr(d, 2); end if;
  if d ~ '^[1-9][1-9](9[0-9]{8}|[2-8][0-9]{7})$' then return d; end if;
  return null;
end;
$$;

-- 2) Colunas em clients --------------------------------------------------------
alter table public.clients add column if not exists phone_key text;
alter table public.clients add column if not exists signup_origin text;
alter table public.clients add column if not exists phone_verified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_signup_origin_check') then
    alter table public.clients add constraint clients_signup_origin_check
      check (signup_origin is null or signup_origin in ('QUICK_QUEUE'));
  end if;
end $$;

-- Preenchimento inicial: só o cadastro mais antigo de cada (barbearia, chave), e só se a
-- chave ainda não estiver em uso. Re-executável.
with k as (
  select id, tenant_id, public.br_phone_key(phone) as key,
         row_number() over (partition by tenant_id, public.br_phone_key(phone) order by created_at, id) as rn
    from public.clients
   where phone_key is null and public.br_phone_key(phone) is not null
)
update public.clients c
   set phone_key = k.key
  from k
 where c.id = k.id
   and k.rn = 1
   and not exists (select 1 from public.clients o where o.tenant_id = c.tenant_id and o.phone_key = k.key);

create unique index if not exists uq_clients_tenant_phone_key
  on public.clients (tenant_id, phone_key) where phone_key is not null;

-- 3) Gatilho: phone_key acompanha o telefone; colunas novas só pelo servidor ----------
create or replace function public.clients_phone_key_sync()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_key text;
  v_restricted boolean := current_user in ('anon', 'authenticated');
begin
  if v_restricted then
    -- Visitante/usuário comum não escolhe origem nem verificação.
    if tg_op = 'INSERT' then
      new.signup_origin := null;
      new.phone_verified_at := null;
    else
      new.signup_origin := old.signup_origin;
      new.phone_verified_at := old.phone_verified_at;
    end if;
  end if;

  if tg_op = 'INSERT' or new.phone is distinct from old.phone or (v_restricted and new.phone_key is distinct from old.phone_key) then
    -- A chave sempre sai do telefone; nunca do valor enviado. Se outra ficha da barbearia já
    -- tem essa chave, esta fica sem (nada é apagado nem juntado).
    v_key := public.br_phone_key(new.phone);
    if v_key is not null and exists (
      select 1 from public.clients o
       where o.tenant_id = new.tenant_id and o.phone_key = v_key
         and (tg_op = 'INSERT' or o.id <> new.id)
    ) then
      v_key := null;
    end if;
    if tg_op = 'UPDATE' and new.phone is not distinct from old.phone and v_restricted then
      new.phone_key := old.phone_key;
    else
      new.phone_key := v_key;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_phone_key_sync on public.clients;
create trigger clients_phone_key_sync
  before insert or update on public.clients
  for each row execute function public.clients_phone_key_sync();

-- 4) Credencial do aparelho ------------------------------------------------------
create table if not exists public.quick_queue_devices (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  token_hash        text not null,
  client_id         uuid references public.clients(id) on delete set null,
  pending_phone_key text,
  pending_until     timestamptz,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  constraint quick_queue_devices_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);
create unique index if not exists uq_quick_queue_devices_hash on public.quick_queue_devices (token_hash);
create index if not exists idx_quick_queue_devices_tenant_created on public.quick_queue_devices (tenant_id, created_at);
create index if not exists idx_quick_queue_devices_pending on public.quick_queue_devices (tenant_id, pending_until)
  where pending_until is not null;

alter table public.quick_queue_devices enable row level security;
revoke all on public.quick_queue_devices from anon, authenticated;

-- 5) Tentativas de identificação (sem telefone) ----------------------------------
create table if not exists public.quick_queue_identify_attempts (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  device_id  uuid references public.quick_queue_devices(id) on delete set null,
  client_id  uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_qq_attempts_tenant on public.quick_queue_identify_attempts (tenant_id, created_at);
create index if not exists idx_qq_attempts_device on public.quick_queue_identify_attempts (device_id, created_at);
create index if not exists idx_qq_attempts_client on public.quick_queue_identify_attempts (client_id, created_at);

alter table public.quick_queue_identify_attempts enable row level security;
revoke all on public.quick_queue_identify_attempts from anon, authenticated;

-- 6) RPC -------------------------------------------------------------------------
-- Resultados: KNOWN (telefone já cadastrado nesta barbearia) · NEED_NAME (telefone novo; pedir
-- o nome) · CREATED (convidado criado) · NO_PENDING (passo do nome sem telefone válido; voltar
-- ao telefone) · LIMIT (limite ou teto) · INVALID (entrada inválida) · CLOSED (fila rápida
-- desligada). new_device = true quando a função emitiu a credencial p_new_device_hash.
drop function if exists public.quick_queue_identify(uuid, text, text, text, text, int, int, int, int, int, int, int, int);
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

  if not exists (
    select 1 from public.tenants t
     where t.id = p_tenant_id and t.quick_queue_enabled and coalesce(t.kind, 'BARBERSHOP') = 'BARBERSHOP'
  ) then
    return query select 'CLOSED'::text, false; return;
  end if;

  if (p_phone_key is null) = (p_name is null) then
    return query select 'INVALID'::text, false; return;
  end if;

  -- Telefone deixado no passo do nome que já venceu: some.
  update public.quick_queue_devices
     set pending_phone_key = null, pending_until = null
   where tenant_id = p_tenant_id and pending_until is not null and pending_until <= v_now;

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
      return query select 'LIMIT'::text, false; return;
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

  -- Tentativas por aparelho e teto por barbearia.
  if (select count(*) from public.quick_queue_identify_attempts
       where device_id = v_dev.id and created_at > v_since) >= p_per_device
     or (select count(*) from public.quick_queue_identify_attempts
       where tenant_id = p_tenant_id and created_at > v_since) >= p_per_tenant then
    return query select 'LIMIT'::text, v_new; return;
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
    return query select 'LIMIT'::text, v_new; return;
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

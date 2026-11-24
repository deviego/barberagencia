-- schema-66: ajustes no cadastro do cliente (#177, #178). Re-executável. Depende da schema-65.
--
--   1. profiles.contact_email / contact_email_verified_at: e-mail de CONTATO da conta (o e-mail de
--      autenticação das contas novas é técnico). Só contato CONFIRMADO vale para login e
--      recuperação de senha.
--   2. contact_email_confirmations: pedidos de confirmação do contato (só o hash do token, validade,
--      uso único). RLS ligada, sem policy; só service_role.
--   3. auth_email_for_contact_email(e-mail): e-mail de autenticação da conta cujo contato
--      CONFIRMADO é esse e-mail. Mais de uma conta, ou nenhuma: null. Só service_role.
--   4. handle_new_user: cópia da schema-65; no ramo de e-mail o cadastro comum cria ficha NOVA e
--      não liga ficha existente (nem por e-mail nem por telefone); e-mail técnico não vira e-mail
--      da ficha. O ramo de provedor que não é e-mail fica igual.
--   5. finalize_client_signup(usuário, contato, hash do convite): chamada SÓ pelo servidor logo
--      depois de criar a conta (o Auth grava o app_metadata depois do insert, então o trigger não
--      enxerga esses dados). Grava o contato (sem confirmar) e, com convite: uso único e atômico
--      (o próprio update marca o convite como aceito; 0 linhas = não liga), barbearia vinda do
--      convite, liga a ficha convidada pelo e-mail ou telefone DO CONVITE. Só service_role.
--
-- Rollback (nesta ordem):
--   1. voltar o código do cadastro/login/recuperação para a versão anterior;
--   2. reaplicar o bloco de handle_new_user da schema-65;
--   3. drop function if exists public.auth_email_for_contact_email(text);
--      drop function if exists public.finalize_client_signup(uuid, text, text);
--   4. a tabela e as colunas podem ficar (não apagar: guardam contatos e confirmações).

-- 1) Contato no perfil ----------------------------------------------------------------------------
alter table public.profiles add column if not exists contact_email text;
alter table public.profiles add column if not exists contact_email_verified_at timestamptz;
create index if not exists idx_profiles_contact_email on public.profiles (lower(contact_email))
  where contact_email is not null;

-- 2) Pedidos de confirmação do contato --------------------------------------------------------------
create table if not exists public.contact_email_confirmations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint contact_email_confirmations_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);
create unique index if not exists uq_contact_email_confirmations_hash on public.contact_email_confirmations (token_hash);
create index if not exists idx_contact_email_confirmations_user on public.contact_email_confirmations (user_id, created_at);
alter table public.contact_email_confirmations enable row level security;
revoke all on public.contact_email_confirmations from public, anon, authenticated;
grant select, insert, update on public.contact_email_confirmations to service_role;

-- 3) Resolução do contato confirmado ---------------------------------------------------------------
create or replace function public.auth_email_for_contact_email(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_n int;
  v_email text;
begin
  if p_email is null or length(trim(p_email)) < 3 then
    return null;
  end if;
  select count(distinct p.id), min(u.email) into v_n, v_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(p.contact_email) = lower(trim(p_email))
     and p.contact_email_verified_at is not null;
  if v_n = 1 then
    return v_email;
  end if;
  return null;
end $$;
revoke execute on function public.auth_email_for_contact_email(text) from public, anon, authenticated;
grant execute on function public.auth_email_for_contact_email(text) to service_role;

-- 4) Cadastro ------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t_id uuid;
  sub text;
  meta_full text := new.raw_user_meta_data->>'full_name';
  meta_phone text := new.raw_user_meta_data->>'phone';
begin
  -- #169 (ADR 0005): só conta de provedor "email" (telefone + senha, e-mail + senha, convite) segue
  -- o fluxo de sempre. Qualquer outro provedor (ex.: Google), ou provedor ausente, cria SÓ o
  -- perfil (nome e foto) e termina: sem cliente, sem vínculo, sem barbearia e sem ligar convite.
  -- O provedor vem de raw_app_meta_data (gravado pelo Auth), nunca de raw_user_meta_data.
  if (new.raw_app_meta_data->>'provider') is distinct from 'email' then
    insert into public.profiles (id, full_name, avatar_url)
      values (
        new.id,
        nullif(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), '')
      )
      on conflict (id) do nothing;
    return new;
  end if;

  insert into public.profiles (id, full_name, phone)
    values (new.id, meta_full, meta_phone)
    on conflict (id) do nothing;

  -- SEM default para Oliveira: sem barbearia definida, não cria client/membership
  -- (evita atribuir um cadastro à barbearia errada).
  sub := nullif(new.raw_user_meta_data->>'tenant_subdomain', '');
  if sub is null then
    return new;
  end if;
  select id into t_id from public.tenants where subdomain = sub limit 1;
  if t_id is null then
    return new;
  end if;

  -- Cadastro comum: ficha NOVA. Não liga ficha existente (nem por e-mail nem por telefone); ficha
  -- de convidado só se liga pelo aceite de convite (finalize_client_signup, servidor). E-mail
  -- técnico de autenticação não vira e-mail da ficha (#177).
  insert into public.clients (tenant_id, user_id, name, email, phone, status)
    values (
      t_id, new.id,
      coalesce(nullif(meta_full, ''), 'Cliente'),
      case when lower(new.email) like '%@cliente.barberagencia.app' then null else new.email end,
      meta_phone, 'ACTIVE'
    );

  insert into public.memberships (user_id, tenant_id, role)
    values (new.id, t_id, 'CLIENT')
    on conflict do nothing;

  return new;
end $function$;

-- 5) Finalização do cadastro pelo servidor -----------------------------------------------------------
create or replace function public.finalize_client_signup(
  p_user_id uuid,
  p_contact_email text,
  p_invite_token_hash text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact text := nullif(lower(trim(p_contact_email)), '');
  v_user record;
  v_inv record;
  v_client uuid;
  v_name text;
  v_phone text;
begin
  -- Só conta de e-mail recém-criada (o servidor chama logo depois do createUser).
  select u.id, u.created_at, u.raw_app_meta_data->>'provider' as provider,
         u.raw_user_meta_data->>'full_name' as full_name, u.raw_user_meta_data->>'phone' as phone
    into v_user
    from auth.users u where u.id = p_user_id;
  if not found or v_user.provider is distinct from 'email' or v_user.created_at < now() - interval '1 hour' then
    return 'INVALID';
  end if;
  if v_contact is not null and (v_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_contact like '%@cliente.barberagencia.app') then
    v_contact := null;
  end if;

  update public.profiles set contact_email = v_contact, contact_email_verified_at = null where id = p_user_id;

  if nullif(p_invite_token_hash, '') is null then
    update public.clients set email = v_contact where user_id = p_user_id;
    return 'OK';
  end if;

  -- Convite: só para conta ainda sem vínculo (o servidor não manda barbearia no cadastro com
  -- convite); a barbearia vem só do convite. Uso único e atômico.
  if exists (select 1 from public.memberships m where m.user_id = p_user_id) then
    return 'INVALID';
  end if;
  update public.client_invites ci
     set status = 'ACCEPTED'
   where encode(sha256(convert_to(ci.token, 'UTF8')), 'hex') = p_invite_token_hash
     and ci.status = 'PENDING'
     and ci.expires_at > now()
  returning ci.tenant_id, ci.email, ci.phone into v_inv;
  if not found then
    return 'INVITE_INVALID';
  end if;

  v_name := coalesce(nullif(v_user.full_name, ''), 'Cliente');
  v_phone := v_user.phone;
  select c.id into v_client from public.clients c
   where c.tenant_id = v_inv.tenant_id and c.status = 'INVITED' and c.user_id is null
     and (
       (v_inv.email is not null and lower(c.email) = lower(v_inv.email))
       or (v_inv.phone is not null and c.phone_key is not null and c.phone_key = public.br_phone_key(v_inv.phone))
     )
   order by c.created_at, c.id
   limit 1
   for update;

  if v_client is not null then
    update public.clients
       set user_id = p_user_id, status = 'ACTIVE', name = coalesce(nullif(v_user.full_name, ''), name),
           email = coalesce(v_contact, email), phone = coalesce(phone, v_phone)
     where id = v_client;
  else
    insert into public.clients (tenant_id, user_id, name, email, phone, status)
      values (v_inv.tenant_id, p_user_id, v_name, v_contact, v_phone, 'ACTIVE');
  end if;
  insert into public.memberships (user_id, tenant_id, role)
    values (p_user_id, v_inv.tenant_id, 'CLIENT')
    on conflict do nothing;
  return 'OK';
end $$;
revoke execute on function public.finalize_client_signup(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_client_signup(uuid, text, text) to service_role;

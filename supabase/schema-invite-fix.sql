-- ============================================================================
-- Correção do fluxo de convite/cadastro + isolamento por barbearia. Idempotente.
--   1) clients.status ('INVITED' | 'ACTIVE') — convidado aparece na lista antes de registrar.
--   2) RPC invite_info(token) — devolve a BARBEARIA do convite (nome/logo/subdomínio),
--      para a página de convite mostrar a barbearia certa (e cadastrar no tenant certo).
--   3) handle_new_user reescrito: NÃO defaulta mais para 'oliveira01' e reconcilia o
--      convidado (linka o clients INVITED em vez de duplicar).
-- ============================================================================

-- 1) status do cliente ---------------------------------------------------------
alter table public.clients
  add column if not exists status text not null default 'ACTIVE'
  check (status in ('INVITED', 'ACTIVE'));

-- 2) info pública do convite (com o tenant) ------------------------------------
drop function if exists public.invite_info(text);
create function public.invite_info(p_token text)
  returns table(
    valid boolean,
    name text,
    email text,
    phone text,
    tenant_id uuid,
    subdomain text,
    tenant_name text,
    logo_text text,
    logo_url text
  )
  language sql security definer set search_path = public as $$
  select
    (i.status = 'PENDING' and i.expires_at > now()) as valid,
    i.name, i.email, i.phone,
    t.id, t.subdomain, t.name,
    coalesce(b.logo_text, upper(left(t.name, 2))),
    b.logo_url
  from public.client_invites i
  join public.tenants t on t.id = i.tenant_id
  left join public.branding b on b.tenant_id = t.id
  where i.token = p_token;
$$;
grant execute on function public.invite_info(text) to anon, authenticated;

-- 3) cadastro ciente do tenant + reconciliação do convite ----------------------
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
  existing_id uuid;
begin
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

  -- Reconcilia um convite pendente (clients INVITED) por e-mail, senão por telefone.
  select id into existing_id from public.clients
    where tenant_id = t_id and status = 'INVITED'
      and (
        (new.email is not null and lower(email) = lower(new.email))
        or (email is null and meta_phone is not null and phone = meta_phone)
      )
    order by created_at
    limit 1;

  if existing_id is not null then
    update public.clients
      set user_id = new.id,
          status  = 'ACTIVE',
          name    = coalesce(nullif(meta_full, ''), name),
          email   = coalesce(email, new.email),
          phone   = coalesce(phone, meta_phone)
      where id = existing_id;
  else
    insert into public.clients (tenant_id, user_id, name, email, phone, status)
      values (
        t_id, new.id,
        coalesce(nullif(meta_full, ''), split_part(new.email, '@', 1)),
        new.email, meta_phone, 'ACTIVE'
      );
  end if;

  insert into public.memberships (user_id, tenant_id, role)
    values (new.id, t_id, 'CLIENT')
    on conflict do nothing;

  return new;
end $function$;

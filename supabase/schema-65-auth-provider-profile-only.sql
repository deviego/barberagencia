-- schema-65: só conta de provedor "email" cria cliente e vínculo no cadastro (#169, ADR 0005).
-- Re-executável. Mesma função do trigger on_auth_user_created (schema.sql).
--
-- handle_new_user: cópia da versão em vigor (schema-invite-fix) com um ramo novo no começo, em lista
-- permitida: só quando raw_app_meta_data->>'provider' = 'email' a conta segue o fluxo de sempre
-- (perfil + cliente + vínculo na barbearia do cadastro + convite pendente). Qualquer outro provedor,
-- ou provedor ausente, cria SÓ o perfil (nome e foto) e termina: sem cliente, sem vínculo, sem
-- barbearia e sem ligar convite. O cliente dessas contas nasce depois, pelo servidor.
-- create or replace mantém as permissões em vigor (schema-21).
--
-- Rollback: reaplicar o bloco de handle_new_user da schema-invite-fix. Contas criadas por outro
-- provedor enquanto a 65 valia continuam só com o perfil (nada é apagado).

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

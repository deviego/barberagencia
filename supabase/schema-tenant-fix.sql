-- Correção de isolamento entre barbearias.

-- 1) Remove leitura pública de tenants/branding (vazava entre tenants).
--    A leitura pública (/b/{slug}, login, cadastro anônimo) passa a ser via service-role no servidor.
drop policy if exists tenants_public_read on public.tenants;
drop policy if exists branding_public_read on public.branding;

-- 2) RLS determinística: escolhe o membership de MAIOR papel (igual ao getSessionUser).
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships where user_id = auth.uid()
  order by case role when 'MASTER' then 3 when 'NETWORK_ADMIN' then 2 when 'UNIT_ADMIN' then 1 else 0 end desc, tenant_id
  limit 1
$$;

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships where user_id = auth.uid()
  order by case role when 'MASTER' then 3 when 'NETWORK_ADMIN' then 2 when 'UNIT_ADMIN' then 1 else 0 end desc, tenant_id
  limit 1
$$;

-- "Atuar como" (super-admin MASTER): permite que um usuário MASTER opere o painel
-- admin de QUALQUER barbearia, sem trocar de RLS para service-role.
--
-- Mecanismo: o servidor injeta o header `x-act-tenant` (a partir do cookie bb_act_tenant)
-- no cliente RLS. auth_tenant_id() passa a honrar esse header — MAS somente quando o
-- usuário tem membership MASTER. Para qualquer outro usuário o header é ignorado e o
-- comportamento é idêntico ao anterior (determinístico pelo maior papel).
--
-- Segurança: o header nunca vem do browser (o browser não fala com o PostgREST direto);
-- é setado só no servidor. E o banco só o aceita para MASTER. Sem spoofing.

create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  with hdr as (
    select nullif(current_setting('request.headers', true)::json ->> 'x-act-tenant', '') as raw
  )
  select case
    when exists (select 1 from public.memberships where user_id = auth.uid() and role = 'MASTER')
         and (select raw from hdr) ~ '^[0-9a-fA-F-]{36}$'
      then (select raw from hdr)::uuid
    else (
      select tenant_id from public.memberships where user_id = auth.uid()
      order by case role when 'MASTER' then 3 when 'NETWORK_ADMIN' then 2 when 'UNIT_ADMIN' then 1 else 0 end desc, tenant_id
      limit 1
    )
  end
$$;

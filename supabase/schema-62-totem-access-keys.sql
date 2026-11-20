-- schema-62: chave de acesso do totem em tabela exclusiva do servidor (expand). Aditiva e
-- re-executável. Não muda nada visível; prepara a schema-63.
--
--   1. public.totem_access_keys (uma linha por barbearia): só service_role. RLS ligada, sem
--      policy, sem permissão para anon/authenticated.
--   2. Copia as chaves atuais de tenants.totem_token (barbearias que têm chave).
--   3. Enquanto tenants.totem_token existir, um gatilho copia para a tabela nova toda chave nova
--      gravada na coluna (o código anterior continua no ar até o deploy). Gravar nulo na coluna
--      não apaga a chave da tabela nova.
-- Depois do deploy, o código lê e grava a chave só nesta tabela.
--   4. Contrato da barbearia (tenant_contracts): leitura com a sessão do usuário passa a exigir
--      admin da barbearia (policy tc_read). Nada é apagado. Quem roda para cliente e precisa do
--      plano/fim do teste lê pelo servidor (src/lib/plan/effective.ts).
--
-- Rollback da policy do contrato (item 4), a qualquer momento:
--   drop policy if exists tc_read on public.tenant_contracts;
--   create policy tc_read on public.tenant_contracts
--     for select using (tenant_id = public.auth_tenant_id());
--
-- Rollback da chave (só ANTES da schema-63; nesta ordem):
--   1. voltar o código para a versão que lê tenants.totem_token;
--   2. drop trigger if exists tenants_totem_key_sync on public.tenants;
--      drop function if exists public.tenants_totem_key_sync();
--   3. a tabela nova pode ficar (só tem cópia das chaves). Depois da schema-63 ela é a única
--      cópia: não apagar.

create table if not exists public.totem_access_keys (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  token      text not null check (char_length(token) >= 32),
  updated_at timestamptz not null default now()
);
alter table public.totem_access_keys enable row level security;
revoke all on public.totem_access_keys from public, anon, authenticated;
grant select, insert, update on public.totem_access_keys to service_role;

insert into public.totem_access_keys (tenant_id, token)
select t.id, t.totem_token
  from public.tenants t
 where t.totem_token is not null and char_length(t.totem_token) >= 32
on conflict (tenant_id) do update
  set token = excluded.token, updated_at = now()
  where public.totem_access_keys.token is distinct from excluded.token;

create or replace function public.tenants_totem_key_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.totem_token is not null and new.totem_token is distinct from old.totem_token then
    insert into public.totem_access_keys (tenant_id, token, updated_at)
    values (new.id, new.totem_token, now())
    on conflict (tenant_id) do update set token = excluded.token, updated_at = excluded.updated_at;
  end if;
  return new;
end $$;
revoke execute on function public.tenants_totem_key_sync() from public, anon, authenticated;

drop trigger if exists tenants_totem_key_sync on public.tenants;
create trigger tenants_totem_key_sync
  after update of totem_token on public.tenants
  for each row execute function public.tenants_totem_key_sync();

-- 4) Contrato: leitura com sessão só para admin da barbearia ---------------------------------------
drop policy if exists tc_read on public.tenant_contracts;
create policy tc_read on public.tenant_contracts
  for select using (tenant_id = public.auth_tenant_id() and public.is_admin());

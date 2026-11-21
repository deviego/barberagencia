-- schema-63: remove tenants.totem_token (contract). Re-executável (sem a coluna, não faz nada).
--
-- APLICAR SÓ DEPOIS de: (a) schema-62 aplicada; (b) código novo no ar (lê e grava a chave do
-- totem só em totem_access_keys); (c) totem testado no ambiente lendo da tabela nova.
-- Fora dessa ordem, o totem das barbearias deixa de abrir.
--
-- Trava: antes de mudar qualquer coisa, confere que TODA barbearia com tenants.totem_token
-- preenchida tem a MESMA chave em totem_access_keys. Se faltar ou divergir uma, para com erro
-- (HF63_KEYS_MISMATCH) sem mudar nada.
--
-- Rollback (recria a coluna com as chaves da tabela nova; nesta ordem):
--   1. alter table public.tenants add column if not exists totem_token text;
--      update public.tenants t set totem_token = k.token
--        from public.totem_access_keys k where k.tenant_id = t.id;
--   2. reaplicar o gatilho da schema-62 (bloco "create or replace function
--      public.tenants_totem_key_sync" até o "create trigger");
--   3. só então voltar o código, se for o caso.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tenants' and column_name = 'totem_token'
  ) then
    return; -- já aplicada
  end if;

  if exists (
    select 1 from public.tenants t
      left join public.totem_access_keys k on k.tenant_id = t.id
     where t.totem_token is not null
       and k.token is distinct from t.totem_token
  ) then
    raise exception 'HF63_KEYS_MISMATCH: barbearia com chave em tenants que falta ou diverge em totem_access_keys; nada foi alterado';
  end if;

  drop trigger if exists tenants_totem_key_sync on public.tenants;
  drop function if exists public.tenants_totem_key_sync();
  alter table public.tenants drop column totem_token;
end $$;

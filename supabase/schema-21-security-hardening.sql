-- ============================================================================
-- ENDURECIMENTO DE SEGURANÇA — Barber Agência (produção)
-- Origem: auditoria /cso de 2026-08-22 (relatório completo em
--         .gstack/security-reports/2026-08-22-cso-barberagencia.md)
--
-- Corrige, nesta ordem:
--   #1 consume_cut sem checagem de autorização e alcançável pelo papel `anon`
--   #2 EXECUTE das funções SECURITY DEFINER aberto ao `anon`
--   #3 policies de escrita do Storage escopadas só pelo bucket
--   #4 drift: colunas que existem em produção mas não em migração nenhuma
--
-- Idempotente. Não apaga dado nenhum. Não muda caminho de arquivo.
-- Rode no SQL Editor do Supabase (projeto tusfxbnnrypjtzqcvpov).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #1 consume_cut: a mesma guarda que return_cut e assign_combo já têm
-- ---------------------------------------------------------------------------
create or replace function public.consume_cut(p_client_id uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare
  novo int;
begin
  if not (public.owns_client(p_client_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;

  update public.client_subscriptions
     set saldo_cortes = saldo_cortes - 1
   where client_id = p_client_id and status = 'ACTIVE' and saldo_cortes > 0
   returning saldo_cortes into novo;
  if novo is null then
    raise exception 'Sem saldo de cortes disponível';
  end if;
  return novo;
end $$;

-- ---------------------------------------------------------------------------
-- #2 Tira o EXECUTE que o Supabase concede por padrão a anon/authenticated
--    ATENÇÃO: não vem de PUBLIC — a ACL é `anon=X/postgres`. Revogar só de
--    PUBLIC é no-op (essa pegadinha custou uma iteração na auditoria).
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

-- Função nova nasce fechada (falha ruidosa em vez de exposta em silêncio).
do $$
begin
  execute 'alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated';
exception when insufficient_privilege then
  raise notice 'sem permissão para default privileges — conceda por função';
end $$;

-- Helpers avaliados DENTRO das policies de RLS: precisam de EXECUTE inclusive
-- para anon (senão a consulta erra em vez de vir vazia).
grant execute on function
  public.auth_tenant_id(),
  public.auth_role(),
  public.is_admin(),
  public.owns_client(uuid)
to anon, authenticated;

-- Fluxo de convite: a página /convite/[token] é pública. O token é
-- crypto.randomUUID() (122 bits), então a capability é o controle de acesso.
grant execute on function
  public.invite_info(text),
  public.invite_status(text),
  public.accept_invite(text)
to anon, authenticated;

-- RPCs do app logado. A guarda interna de cada uma continua valendo.
grant execute on function
  public.consume_cut(uuid),
  public.return_cut(uuid),
  public.assign_combo(uuid, uuid),
  public.booked_starts(uuid, timestamptz, timestamptz),
  public.join_queue(uuid, uuid, uuid),
  public.leave_queue(uuid),
  public.activate_fixed_plan(uuid, uuid, integer, integer, uuid, uuid),
  public.add_fixed_makeup(uuid),
  public.cancel_future_plan_appointments(uuid),
  public.ensure_fixed_reservations(uuid)
to authenticated;

-- Triggers: chamadas direto elas falham ("can only be called as trigger").
grant execute on function public.handle_new_user(), public.plan_barber_limit() to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.handle_new_user() to supabase_auth_admin';
  end if;
end $$;

-- join_queue_totem e totem_find_client seguem exclusivas do service_role
-- (o revoke acima manteve isso; o grant de service_role está garantido).

-- ---------------------------------------------------------------------------
-- #3 Storage: escopa a escrita pelo DONO do arquivo.
--    Usa storage.objects.owner (já preenchido nos 4 objetos existentes), então
--    NÃO precisa renomear arquivo nem atualizar URL no banco.
-- ---------------------------------------------------------------------------
drop policy if exists avatars_auth_insert on storage.objects;
create policy avatars_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');           -- criar é livre; o dono é gravado pelo Storage

drop policy if exists avatars_auth_update on storage.objects;
create policy avatars_auth_update on storage.objects for update to authenticated
  using      (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists avatars_auth_delete on storage.objects;
create policy avatars_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists products_auth_insert on storage.objects;
create policy products_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and public.is_admin());

drop policy if exists products_auth_update on storage.objects;
create policy products_auth_update on storage.objects for update to authenticated
  using      (bucket_id = 'products' and public.is_admin() and owner = auth.uid())
  with check (bucket_id = 'products' and public.is_admin() and owner = auth.uid());

drop policy if exists products_auth_delete on storage.objects;
create policy products_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'products' and public.is_admin() and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- #4 Drift: estas colunas EXISTEM em produção mas não estavam em migração
--    nenhuma (foram criadas à mão no SQL Editor). Sem isto, o repositório não
--    consegue reconstruir o banco — um restore quebraria o agendamento.
-- ---------------------------------------------------------------------------
alter table public.appointments     add column if not exists payment_method text;
alter table public.tenant_settings  add column if not exists onboarding_snoozed_at timestamptz;

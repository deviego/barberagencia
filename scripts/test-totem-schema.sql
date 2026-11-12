-- Testes executados da schema-50 (dados fictícios). SOMENTE em banco LOCAL e descartável,
-- com o schema do projeto e a schema-50 já aplicados. Tudo roda em uma transação com ROLLBACK.
--
--   psql "postgresql://postgres@127.0.0.1:<porta>/<banco_descartavel>" -v ON_ERROR_STOP=1 -f scripts/test-totem-schema.sql
--
-- O script recusa rodar se a conexão não for local.
-- ATENÇÃO: essa conferência olha só o endereço que o servidor enxerga. Um banco remoto acessado
-- por túnel (ssh -L, proxy local) também aparece como 127.0.0.1 e passaria. Confira você mesmo
-- que o destino é um banco descartável antes de rodar. Nunca aponte para banco do projeto.
\set ON_ERROR_STOP on
begin;

do $$ begin
  if inet_server_addr() is not null and host(inet_server_addr()) not in ('127.0.0.1', '::1') then
    raise exception 'ABORTADO: este teste só roda em banco local descartável';
  end if;
end $$;

-- ---- Dados fictícios: duas barbearias -----------------------------------------
insert into public.tenants (id, name, subdomain) values
  ('a0000000-0000-4000-8000-000000000001', 'Barbearia Teste A', 'totem-teste-a'),
  ('b0000000-0000-4000-8000-000000000002', 'Barbearia Teste B', 'totem-teste-b');

insert into public.clients (id, tenant_id, name, phone, created_at) values
  -- telefone repetido na barbearia A: o mais antigo é o "Fulano Antigo"
  ('a1000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000001', 'Fulano Novo',   '(21) 99999-0000', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'Fulano Antigo', '21 99999 0000',   now() - interval '30 days'),
  ('a1000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-000000000001', 'Beltrano A',    '(21) 98888-0000', now()),
  -- mesmo telefone na barbearia B
  ('b1000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000002', 'Sicrano B',     '(21) 99999-0000', now() - interval '60 days');

insert into public.services (id, tenant_id, name, duration_min, price_brl, active) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Corte Teste',   30, 40, true),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Inativo Teste', 30, 40, false),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Corte B Teste', 30, 40, true);

insert into public.barbers (id, tenant_id, name, active, accepts_queue) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Barbeiro Teste',      true,  true),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Barbeiro Inativo',    false, true),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Barbeiro Sem Fila',   true,  false),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Barbeiro B Teste',    true,  true);

insert into public.combo_plans (id, tenant_id, name, cuts, price_brl) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Plano Teste', 4, 100);
insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, status) values
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', 'a4000000-0000-4000-8000-000000000001', 'ACTIVE');

-- Espera que o comando falhe com a mensagem dada.
create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then
      raise exception 'erro inesperado em [%]: %', p_sql, sqlerrm;
    end if;
    return;
  end;
  raise exception 'deveria ter falhado: %', p_sql;
end $$;

-- ---- 1. Privilégios: visitante e usuário comum não executam nem leem ------------
do $$
declare r text; f text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach f in array array[
      'public.rate_limit_hit(text, text, int, int)',
      'public.join_queue_totem(uuid, uuid, uuid, uuid)',
      'public.totem_resolve_client_id(uuid, text)',
      'public.totem_lookup_client(uuid, text)'
    ] loop
      assert not has_function_privilege(r, f, 'execute'), format('%s executa %s', r, f);
    end loop;
    assert not has_table_privilege(r, 'public.rate_limit_events', 'select'), r || ' lê rate_limit_events';
    assert not has_table_privilege(r, 'public.rate_limit_events', 'insert'), r || ' grava rate_limit_events';
  end loop;
  assert has_table_privilege('service_role', 'public.rate_limit_events', 'select,insert');
  assert (select relrowsecurity from pg_class where oid = 'public.rate_limit_events'::regclass), 'RLS desligada';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rate_limit_events'), 'há policy';
  -- totem_find_client continua com o mesmo retorno (o código no ar depende dele).
  assert pg_get_function_result('public.totem_find_client(uuid, text)'::regprocedure)
         = 'TABLE(id uuid, name text, has_plan boolean, plan_name text)';
end $$;

-- Daqui em diante, como o servidor (service_role).
set local role service_role;

-- ---- 2. Limite de tentativas ---------------------------------------------------
do $$
declare ok int := 0; i int;
begin
  for i in 1..5 loop
    if public.rate_limit_hit('teste_escopo', 'chave-1', 600, 3) then ok := ok + 1; end if;
  end loop;
  assert ok = 3, format('limite 3: %s aceitas', ok);
  assert public.rate_limit_hit('teste_escopo', 'chave-2', 600, 3), 'outra chave deveria passar';
  assert public.rate_limit_hit('teste_outro', 'chave-1', 600, 3), 'outro escopo deveria passar';
  assert (select count(*) from public.rate_limit_events where scope = 'teste_escopo' and key = 'chave-1') = 3,
         'tentativa recusada foi gravada';
  -- fora da janela não conta
  update public.rate_limit_events set created_at = created_at - interval '11 minutes'
   where scope = 'teste_escopo' and key = 'chave-1';
  assert public.rate_limit_hit('teste_escopo', 'chave-1', 600, 3), 'janela vencida deveria liberar';
end $$;
select pg_temp.expect_error($q$select public.rate_limit_hit('x', 'y', 0, 3)$q$, 'RATE_LIMIT_INVALID_ARGS');
select pg_temp.expect_error($q$select public.rate_limit_hit(null, 'y', 60, 3)$q$, 'RATE_LIMIT_INVALID_ARGS');

-- ---- 3. Regra única para achar o cliente ----------------------------------------
do $$
declare v_id uuid; v_name text; v_has boolean; v_plan text; v_find_id uuid;
begin
  -- telefone repetido: sempre o cadastro mais antigo, na busca e na resolução do id
  v_id := public.totem_resolve_client_id('a0000000-0000-4000-8000-000000000001', '21999990000');
  assert v_id = 'a1000000-0000-4000-8000-0000000000a1', 'resolveu o cadastro errado';
  select name, has_plan, plan_name into v_name, v_has, v_plan
    from public.totem_lookup_client('a0000000-0000-4000-8000-000000000001', '21999990000');
  assert v_name = 'Fulano Antigo' and v_has and v_plan = 'Plano Teste', 'busca não bate com o id resolvido';
  assert (select count(*) from public.totem_lookup_client('a0000000-0000-4000-8000-000000000001', '21999990000')) = 1;

  -- mesma barbearia, outro telefone
  select name, has_plan, plan_name into v_name, v_has, v_plan
    from public.totem_lookup_client('a0000000-0000-4000-8000-000000000001', '21988880000');
  assert v_name = 'Beltrano A' and not v_has and v_plan is null;

  -- mesmo telefone na outra barbearia: só o cliente dela
  assert public.totem_resolve_client_id('b0000000-0000-4000-8000-000000000002', '21999990000')
         = 'b1000000-0000-4000-8000-0000000000b1';
  select name into v_name from public.totem_lookup_client('b0000000-0000-4000-8000-000000000002', '21999990000');
  assert v_name = 'Sicrano B';

  -- não cadastrado
  assert public.totem_resolve_client_id('a0000000-0000-4000-8000-000000000001', '21900000000') is null;
  assert not exists (select 1 from public.totem_lookup_client('a0000000-0000-4000-8000-000000000001', '21900000000'));
end $$;

-- ---- 4. Senha pelo totem: conferências ------------------------------------------
-- cliente de outra barbearia / nulos
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-0000000000b1', null, null)$q$, 'TOTEM_CLIENT_NOT_IN_TENANT');
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', null, null, null)$q$, 'TOTEM_CLIENT_NOT_IN_TENANT');
select pg_temp.expect_error($q$select public.join_queue_totem(null, 'a1000000-0000-4000-8000-0000000000a1', null, null)$q$, 'TOTEM_CLIENT_NOT_IN_TENANT');
-- serviço de outra barbearia / inativo
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', 'b2000000-0000-4000-8000-000000000001', null)$q$, 'TOTEM_SERVICE_NOT_IN_TENANT');
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', 'a2000000-0000-4000-8000-000000000002', null)$q$, 'TOTEM_SERVICE_NOT_IN_TENANT');
-- barbeiro de outra barbearia / inativo / que não atende fila
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', null, 'b3000000-0000-4000-8000-000000000001')$q$, 'TOTEM_BARBER_NOT_IN_TENANT');
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', null, 'a3000000-0000-4000-8000-000000000002')$q$, 'TOTEM_BARBER_NOT_IN_TENANT');
select pg_temp.expect_error($q$select public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', null, 'a3000000-0000-4000-8000-000000000003')$q$, 'TOTEM_BARBER_NOT_IN_TENANT');

do $$
declare r1 public.queue_entries; r2 public.queue_entries; r3 public.queue_entries;
begin
  assert not exists (select 1 from public.queue_entries where tenant_id = 'a0000000-0000-4000-8000-000000000001'),
         'tentativa recusada gravou senha';

  r1 := public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1',
                                'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001');
  assert r1.ticket_number = 1 and r1.tenant_id = 'a0000000-0000-4000-8000-000000000001';
  -- mesmo cliente de novo: mesma senha
  r2 := public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1', null, null);
  assert r2.id = r1.id and r2.ticket_number = 1 and r2.service_id = r1.service_id, 'gerou outra senha para o mesmo cliente';
  -- outro cliente, sem serviço nem barbeiro (cliente de plano)
  r3 := public.join_queue_totem('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a3', null, null);
  assert r3.ticket_number = 2;
  -- a numeração é por barbearia
  assert (public.join_queue_totem('b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-0000000000b1', null, null)).ticket_number = 1;
end $$;

reset role;
rollback;
\echo 'schema-50: todos os testes executados passaram (transação desfeita).'

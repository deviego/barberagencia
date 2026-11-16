-- ============================================================================
-- Teste de isolamento das RPCs de cliente (schema-33). SÓ STAGING.
-- Rode no SQL Editor do Supabase de staging DEPOIS de aplicar schema-33.
-- Tudo roda numa transação com ROLLBACK no fim: nada fica gravado.
-- Dados 100% fictícios (tenants/usuários de teste, e-mails @example.test).
--
-- Esperado: só NOTICEs "OK ..." e nenhum "FALHOU ...".
-- Antes do schema-33, os casos "admin A → cliente B" saem como FALHOU.
-- ============================================================================
begin;

-- ---- IDs fictícios -----------------------------------------------------------
--   tenant A   aaaaaaaa-0000-4000-8000-00000000000a | tenant B   bbbbbbbb-0000-4000-8000-00000000000b
--   adminA     aaaaaaaa-0000-4000-8000-0000000000a1 | adminB     bbbbbbbb-0000-4000-8000-0000000000b1
--   userCliA   aaaaaaaa-0000-4000-8000-0000000000e1 | master     cccccccc-0000-4000-8000-0000000000f1 (casa = A)
--   clienteA   aaaaaaaa-0000-4000-8000-0000000000c1 | clienteB   bbbbbbbb-0000-4000-8000-0000000000c1
--   barbeiro   ...-0000000000d1 | serviço ...-0000000000d2 | combo livre ...-0000000000d3 | combo fixo ...-0000000000d4

-- ---- Fixtures (como postgres) ------------------------------------------------
insert into public.tenants (id, name, subdomain) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'Teste RLS A', 'teste-rls-a'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Teste RLS B', 'teste-rls-b');

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-a@example.test',   '{}', now(), now()),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-b@example.test',   '{}', now(), now()),
  ('aaaaaaaa-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cliente-a@example.test', '{}', now(), now()),
  ('cccccccc-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'master@example.test',    '{}', now(), now());
-- handle_new_user cria o profile; sem tenant_subdomain não cria membership.
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1'), ('bbbbbbbb-0000-4000-8000-0000000000b1'),
  ('aaaaaaaa-0000-4000-8000-0000000000e1'), ('cccccccc-0000-4000-8000-0000000000f1')
on conflict (id) do nothing;

insert into public.memberships (user_id, tenant_id, role) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'UNIT_ADMIN'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'UNIT_ADMIN'),
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'CLIENT'),
  ('cccccccc-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'MASTER');

insert into public.clients (id, tenant_id, user_id, name) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000e1', 'Cliente Teste A'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-00000000000b', null, 'Cliente Teste B');

insert into public.barbers (id, tenant_id, name) values
  ('aaaaaaaa-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Barbeiro A'),
  ('bbbbbbbb-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Barbeiro B');
insert into public.services (id, tenant_id, name, duration_min, price_brl) values
  ('aaaaaaaa-0000-4000-8000-0000000000d2', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Corte A', 30, 40),
  ('bbbbbbbb-0000-4000-8000-0000000000d2', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Corte B', 30, 40);
insert into public.combo_plans (id, tenant_id, name, cuts, price_brl, booking_mode, service_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000d3', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Livre A', 4, 100, 'FLEXIBLE', null),
  ('aaaaaaaa-0000-4000-8000-0000000000d4', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Fixo A',  4, 120, 'FIXED', 'aaaaaaaa-0000-4000-8000-0000000000d2'),
  ('bbbbbbbb-0000-4000-8000-0000000000d3', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Livre B', 4, 100, 'FLEXIBLE', null),
  ('bbbbbbbb-0000-4000-8000-0000000000d4', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Fixo B',  4, 120, 'FIXED', 'bbbbbbbb-0000-4000-8000-0000000000d2');
insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, saldo_cortes, status) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000d3', 4, 'ACTIVE'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000d3', 4, 'ACTIVE');

-- ============================================================================
-- 1) admin A tentando agir em cliente B → todas 'forbidden'
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select set_config('request.headers', '{}', true);

do $$
declare
  cb constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000c1';
  calls text[] := array[
    format('select public.consume_cut(%L)', cb),
    format('select public.return_cut(%L)', cb),
    format('select public.assign_combo(%L, %L)', cb, 'bbbbbbbb-0000-4000-8000-0000000000d3'),
    format('select public.activate_fixed_plan(%L, %L, 1, 600, %L, %L)', cb, 'bbbbbbbb-0000-4000-8000-0000000000d4',
           'bbbbbbbb-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-0000000000d2'),
    format('select public.add_fixed_makeup(%L)', cb),
    format('select public.cancel_future_plan_appointments(%L)', cb),
    format('select public.ensure_fixed_reservations(%L)', cb)
  ];
  c text;
begin
  foreach c in array calls loop
    begin
      execute c;
      raise notice 'FALHOU (passou sem bloquear): %', c;
    exception when others then
      if sqlerrm = 'forbidden' then raise notice 'OK bloqueado: %', c;
      else raise notice 'FALHOU (erro diferente de forbidden: %): %', sqlerrm, c; end if;
    end;
  end loop;
end $$;

-- 2) admin A no próprio cliente → funciona
do $$
begin
  perform public.consume_cut('aaaaaaaa-0000-4000-8000-0000000000c1');
  perform public.return_cut('aaaaaaaa-0000-4000-8000-0000000000c1');
  perform public.assign_combo('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000d3');
  raise notice 'OK admin A opera o próprio cliente';
exception when others then raise notice 'FALHOU admin A no próprio cliente: %', sqlerrm;
end $$;

-- 3) admin A ativando plano fixo com barbeiro de B → 'barbeiro inválido'
do $$
begin
  perform public.activate_fixed_plan('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000d4',
                                     1, 600, 'bbbbbbbb-0000-4000-8000-0000000000d1', null);
  raise notice 'FALHOU aceitou barbeiro de outra barbearia';
exception when others then
  if sqlerrm = 'barbeiro inválido' then raise notice 'OK barbeiro de outro tenant recusado';
  else raise notice 'FALHOU erro inesperado: %', sqlerrm; end if;
end $$;

-- 4) children: admin A não cria filho para cliente B nem lê filhos de B
do $$
begin
  insert into public.children (tenant_id, client_id, name)
    values ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-0000000000c1', 'Filho Teste');
  raise notice 'FALHOU admin A criou filho para cliente B';
exception when others then raise notice 'OK children bloqueado (%).', sqlerrm;
end $$;
reset role;
insert into public.children (tenant_id, client_id, name)
  values ('bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-0000000000c1', 'Filho Teste B');
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.children where tenant_id = 'bbbbbbbb-0000-4000-8000-00000000000b';
  if n = 0 then raise notice 'OK admin A não lê filhos de B';
  else raise notice 'FALHOU admin A leu % filho(s) de B', n; end if;
end $$;

-- ============================================================================
-- 5) usuário cliente A: assign_combo agora é só admin; consume_cut no próprio continua
-- ============================================================================
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
do $$
begin
  perform public.assign_combo('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000d3');
  raise notice 'FALHOU cliente conseguiu se dar combo';
exception when others then
  if sqlerrm = 'forbidden' then raise notice 'OK cliente não chama assign_combo';
  else raise notice 'FALHOU erro inesperado: %', sqlerrm; end if;
end $$;
do $$
begin
  perform public.consume_cut('aaaaaaaa-0000-4000-8000-0000000000c1');
  perform public.ensure_fixed_reservations('aaaaaaaa-0000-4000-8000-0000000000c1');
  raise notice 'OK cliente consome o próprio corte';
exception when others then raise notice 'FALHOU cliente no próprio corte: %', sqlerrm;
end $$;

-- ============================================================================
-- 6) MASTER: sem "atuar como" fica no tenant de casa (A); atuando como B, opera B
-- ============================================================================
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
select set_config('request.headers', '{}', true);
do $$
begin
  perform public.consume_cut('bbbbbbbb-0000-4000-8000-0000000000c1');
  raise notice 'FALHOU master sem atuar-como mexeu em B';
exception when others then
  if sqlerrm = 'forbidden' then raise notice 'OK master sem atuar-como bloqueado em B';
  else raise notice 'FALHOU erro inesperado: %', sqlerrm; end if;
end $$;
select set_config('request.headers', '{"x-act-tenant":"bbbbbbbb-0000-4000-8000-00000000000b"}', true);
do $$
begin
  perform public.consume_cut('bbbbbbbb-0000-4000-8000-0000000000c1');
  raise notice 'OK master atuando como B opera cliente B';
exception when others then raise notice 'FALHOU master atuando como B: %', sqlerrm;
end $$;

-- 7) admin B no próprio cliente → funciona
select set_config('request.headers', '{}', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$
begin
  perform public.consume_cut('bbbbbbbb-0000-4000-8000-0000000000c1');
  raise notice 'OK admin B opera o próprio cliente';
exception when others then raise notice 'FALHOU admin B no próprio cliente: %', sqlerrm;
end $$;

reset role;
-- Saldo final do cliente B: 4 - 1 (master como B) - 1 (admin B) = 2. Qualquer outro valor = vazamento.
select saldo_cortes as saldo_cliente_b_esperado_2
  from public.client_subscriptions where client_id = 'bbbbbbbb-0000-4000-8000-0000000000c1';

rollback;

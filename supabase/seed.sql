-- ============================================================================
-- Seed — tenant FICTÍCIO de referência "Barbearia Exemplo" + catálogo.
-- Uso: desenvolvimento local e CI. Rode DEPOIS do schema.sql e das migrações.
-- Idempotente: pode rodar várias vezes sem duplicar nada.
--
-- LGPD: SOMENTE dados fictícios. Proibido nome, telefone, e-mail, CPF, endereço,
-- Instagram ou foto de barbearia, barbeiro ou cliente real. Se precisar de usuário
-- ou cliente de teste, use e-mail @example.test e telefone (00) 00000-0000.
-- Nunca rode este arquivo em produção.
--
-- IDs fixos com o dígito de versão 0 (eeeeeeee-0000-0000-...): gen_random_uuid() só gera
-- UUID v4, então nunca coincidem com um tenant real. Não reutilize o antigo ...0001: ele é
-- o id de uma barbearia real em produção.
-- ============================================================================
begin;

-- Guarda: só roda num banco vazio ou que só tenha o tenant Exemplo. Em produção (ou num
-- staging com barbearias) aborta antes de inserir qualquer coisa. No CI, rode o seed ANTES
-- de criar os tenants de teste.
do $$
begin
  if exists (select 1 from public.tenants where id <> 'eeeeeeee-0000-0000-0000-000000000001') then
    raise exception 'seed.sql ABORTADO: o banco já tem outras barbearias. Este seed só roda em banco vazio (local/CI), nunca em produção.';
  end if;
end $$;

-- Tenant + branding (uuid fixo para referência)
insert into public.tenants (id, name, subdomain, saas_plan, status)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Barbearia Exemplo', 'exemplo', 'advance', 'ACTIVE')
on conflict (id) do nothing;

insert into public.branding (tenant_id, logo_text, instagram)
values ('eeeeeeee-0000-0000-0000-000000000001', 'BE', null)
on conflict (tenant_id) do nothing;

-- Serviços avulsos (sem chave única: o "where not exists" evita duplicar ao rodar de novo)
insert into public.services (tenant_id, name, duration_min, price_brl, category)
select v.* from (values
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Corte Simples',  45, 40, 'corte'),
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Corte Infantil', 30, 35, 'corte'),
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Barba Simples',  30, 30, 'barba'),
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Barba Especial', 60, 80, 'barba')
) as v(tenant_id, name, duration_min, price_brl, category)
where not exists (select 1 from public.services s where s.tenant_id = v.tenant_id and s.name = v.name);

-- Combos (assinatura)
insert into public.combo_plans (tenant_id, name, cuts, scope, price_brl)
select v.* from (values
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Combo Mensal Infantil', 2, 'cabelo', 120),
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Combo Mensal Adulto',   2, 'cabelo', 140),
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Combo Mensal Completo', 4, 'cabelo+barba+sobrancelha', 200)
) as v(tenant_id, name, cuts, scope, price_brl)
where not exists (select 1 from public.combo_plans c where c.tenant_id = v.tenant_id and c.name = v.name);

-- Barbeiros fictícios (uuid fixo p/ anexar horários)
insert into public.barbers (id, tenant_id, name) values
  ('eeeeeeee-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-000000000001', 'Barbeiro Teste 1'),
  ('eeeeeeee-0000-0000-0000-0000000000b2', 'eeeeeeee-0000-0000-0000-000000000001', 'Barbeiro Teste 2')
on conflict (id) do nothing;

-- Horários: seg–sex 09:00–20:00 (540–1200), sáb 09:00–18:00 (540–1080)
insert into public.working_hours (barber_id, weekday, start_min, end_min)
select b.id, d.weekday, 540, case when d.weekday = 6 then 1080 else 1200 end
from (values
  ('eeeeeeee-0000-0000-0000-0000000000b1'::uuid),
  ('eeeeeeee-0000-0000-0000-0000000000b2'::uuid)
) as b(id)
cross join (values (1),(2),(3),(4),(5),(6)) as d(weekday)
where not exists (select 1 from public.working_hours w where w.barber_id = b.id and w.weekday = d.weekday);

commit;

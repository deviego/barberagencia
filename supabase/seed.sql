-- ============================================================================
-- Seed — tenant de referência "Barbearia Oliveira 01" + catálogo.
-- Rode DEPOIS do schema.sql. Idempotente (on conflict do nothing).
-- ============================================================================
begin;

-- Tenant + branding (uuid fixo para referência)
insert into public.tenants (id, name, subdomain, saas_plan, status)
values ('00000000-0000-0000-0000-000000000001', 'Barbearia Oliveira 01', 'oliveira01', 'advance', 'ACTIVE')
on conflict (id) do nothing;

insert into public.branding (tenant_id, logo_text, instagram)
values ('00000000-0000-0000-0000-000000000001', 'BO', '@barbeariaoliveira01')
on conflict (tenant_id) do nothing;

-- Serviços avulsos
insert into public.services (tenant_id, name, duration_min, price_brl, category) values
  ('00000000-0000-0000-0000-000000000001', 'Corte Simples',  45, 40, 'corte'),
  ('00000000-0000-0000-0000-000000000001', 'Corte Infantil', 30, 35, 'corte'),
  ('00000000-0000-0000-0000-000000000001', 'Barba Simples',  30, 30, 'barba'),
  ('00000000-0000-0000-0000-000000000001', 'Barba Especial', 60, 80, 'barba')
on conflict do nothing;

-- Combos (assinatura)
insert into public.combo_plans (tenant_id, name, cuts, scope, price_brl) values
  ('00000000-0000-0000-0000-000000000001', 'Combo Mensal Infantil', 2, 'cabelo', 120),
  ('00000000-0000-0000-0000-000000000001', 'Combo Mensal 01 Adulto', 2, 'cabelo', 140),
  ('00000000-0000-0000-0000-000000000001', 'Combo Mensal 02', 4, 'cabelo+barba+sobrancelha', 200)
on conflict do nothing;

-- Barbeiros (uuid fixo p/ anexar horários)
insert into public.barbers (id, tenant_id, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'Rodrigo'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000001', 'Marcos')
on conflict (id) do nothing;

-- Horários: seg–sex 09:00–20:00 (540–1200), sáb 09:00–18:00 (540–1080)
insert into public.working_hours (barber_id, weekday, start_min, end_min)
select b.id, d.weekday, 540, case when d.weekday = 6 then 1080 else 1200 end
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid),
  ('00000000-0000-0000-0000-0000000000b2'::uuid)
) as b(id)
cross join (values (1),(2),(3),(4),(5),(6)) as d(weekday)
on conflict do nothing;

commit;

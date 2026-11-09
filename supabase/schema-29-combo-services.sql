-- ============================================================================
-- Barbearia White-Label — schema v29 (aditivo). Planos combo com VÁRIOS serviços.
-- Cada visita usando o plano cobre o combo inteiro (a lógica de cobertura lê esta
-- tabela). combo_plans.service_id continua sendo a semente do modo FIXO.
-- Idempotente. Rode com: node dbadmin.mjs supabase/schema-29-combo-services.sql
-- ============================================================================

create table if not exists public.combo_plan_services (
  combo_plan_id uuid not null references public.combo_plans(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (combo_plan_id, service_id)
);
create index if not exists cps_service_idx on public.combo_plan_services (service_id);

alter table public.combo_plan_services enable row level security;

-- Admin do tenant gerencia; qualquer usuário do tenant lê (o cliente precisa no agendar).
drop policy if exists cps_admin on public.combo_plan_services;
create policy cps_admin on public.combo_plan_services for all
  using (exists (select 1 from public.combo_plans c
                  where c.id = combo_plan_id and c.tenant_id = public.auth_tenant_id() and public.is_admin()))
  with check (exists (select 1 from public.combo_plans c
                       where c.id = combo_plan_id and c.tenant_id = public.auth_tenant_id() and public.is_admin()));

drop policy if exists cps_read on public.combo_plan_services;
create policy cps_read on public.combo_plan_services for select
  using (exists (select 1 from public.combo_plans c
                  where c.id = combo_plan_id and c.tenant_id = public.auth_tenant_id()));

-- Backfill: planos que já tinham um serviço único viram combos de 1 serviço.
insert into public.combo_plan_services (combo_plan_id, service_id)
  select id, service_id from public.combo_plans where service_id is not null
  on conflict do nothing;

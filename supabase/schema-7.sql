-- ============================================================================
-- Barbearia White-Label — schema v7 (aditivo). Comanda: itens do agendamento
-- (serviços + produtos numa mesma solicitação). Idempotente.
-- ============================================================================
create table if not exists public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('service','product')),
  ref_id uuid,
  name text not null,
  price_brl numeric(10,2) not null default 0,
  qty int not null default 1,
  covered_by_plan boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists appointment_items_appt_idx on public.appointment_items (appointment_id);

alter table public.appointment_items enable row level security;

-- Dono do agendamento lê/insere os itens; admin do tenant gerencia tudo.
drop policy if exists appt_items_read on public.appointment_items;
create policy appt_items_read on public.appointment_items for select
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and (public.owns_client(a.client_id) or (a.tenant_id = public.auth_tenant_id() and public.is_admin()))
    )
  );

drop policy if exists appt_items_client_insert on public.appointment_items;
create policy appt_items_client_insert on public.appointment_items for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id and public.owns_client(a.client_id)
    )
  );

drop policy if exists appt_items_admin on public.appointment_items;
create policy appt_items_admin on public.appointment_items for all
  using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

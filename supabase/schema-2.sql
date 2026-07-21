-- ============================================================================
-- Barbearia White-Label — schema v2 (aditivo). Rode DEPOIS de schema.sql.
-- Novas tabelas + colunas + RPCs para: produtos, POS/vendas, financeiro,
-- campanhas, convites, reservas, logs. Idempotente.
-- ============================================================================

-- ---- Colunas extras em appointments ----
alter table public.appointments add column if not exists no_show boolean not null default false;
alter table public.appointments add column if not exists rescheduled_from uuid;

-- ---- Produtos ----
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sku text,
  price_brl numeric(10,2) not null,
  cost_brl numeric(10,2) not null default 0,
  stock int not null default 0,
  active boolean not null default true,
  deleted_at timestamptz
);
create index if not exists products_tenant_idx on public.products (tenant_id);

-- ---- Pagamentos (registro; no-local) ----
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  method text not null check (method in ('PIX','CARD_CREDIT','CARD_DEBIT','CASH','PLAN')),
  amount_brl numeric(10,2) not null,
  status text not null default 'PAID' check (status in ('PENDING','PAID','REFUNDED','FAILED')),
  created_at timestamptz not null default now()
);
create index if not exists payments_tenant_idx on public.payments (tenant_id);

-- ---- Vendas (POS) ----
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  total_brl numeric(10,2) not null,
  payment_id uuid references public.payments(id),
  created_at timestamptz not null default now()
);
create index if not exists sales_tenant_idx on public.sales (tenant_id);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  kind text not null,            -- 'service' | 'product'
  ref_id uuid,
  name text not null,
  price_brl numeric(10,2) not null,
  qty int not null default 1
);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

-- ---- Financeiro ----
create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('REVENUE','EXPENSE','WITHDRAWAL')),
  amount_brl numeric(10,2) not null,
  method text check (method in ('PIX','CARD_CREDIT','CARD_DEBIT','CASH','PLAN')),
  ref_client uuid,
  ref_barber uuid,
  ref_kind text,                 -- 'service' | 'product' | 'subscription' | 'withdrawal'
  note text,
  occurred_at timestamptz not null default now()
);
create index if not exists fin_tenant_occurred_idx on public.financial_entries (tenant_id, occurred_at);

-- ---- Campanhas ----
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  segment text not null,
  message text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SCHEDULED','ACTIVE','ENDED')),
  scheduled_at timestamptz,
  reach int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists campaigns_tenant_idx on public.campaigns (tenant_id);

-- ---- Convites de cliente (48h) ----
create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token text unique not null,
  name text,
  email text,
  phone text,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists client_invites_tenant_idx on public.client_invites (tenant_id);

-- ---- Reservas de produto (retirada) ----
create table if not exists public.product_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty int not null default 1,
  status text not null default 'RESERVED' check (status in ('RESERVED','PICKED_UP','CANCELLED')),
  created_at timestamptz not null default now()
);
create index if not exists reservations_tenant_idx on public.product_reservations (tenant_id);

-- ---- Logs ----
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  channel text,
  template text,
  recipient text,
  status text,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  action text,
  target text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.products             enable row level security;
alter table public.payments             enable row level security;
alter table public.sales                enable row level security;
alter table public.sale_items           enable row level security;
alter table public.financial_entries    enable row level security;
alter table public.campaigns            enable row level security;
alter table public.client_invites       enable row level security;
alter table public.product_reservations enable row level security;
alter table public.notification_log     enable row level security;
alter table public.audit_log            enable row level security;

-- produtos: membros do tenant leem; admin gerencia
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (tenant_id = public.auth_tenant_id());
drop policy if exists products_admin on public.products;
create policy products_admin on public.products for all
  using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- payments / sales / sale_items / financial / campaigns / invites / logs: só admin do tenant
do $$
declare tbl text;
begin
  foreach tbl in array array['payments','sales','financial_entries','campaigns','client_invites','notification_log','audit_log']
  loop
    execute format('drop policy if exists %I_admin on public.%I', tbl, tbl);
    execute format(
      'create policy %I_admin on public.%I for all using (tenant_id = public.auth_tenant_id() and public.is_admin()) with check (tenant_id = public.auth_tenant_id() and public.is_admin())',
      tbl, tbl
    );
  end loop;
end $$;

-- sale_items: admin do tenant via join com sales
drop policy if exists sale_items_admin on public.sale_items;
create policy sale_items_admin on public.sale_items for all
  using (public.is_admin() and exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id = public.auth_tenant_id()))
  with check (public.is_admin() and exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id = public.auth_tenant_id()));

-- reservas: cliente lê/cria as suas; admin gerencia
drop policy if exists reservations_client on public.product_reservations;
create policy reservations_client on public.product_reservations for select
  using (public.owns_client(client_id) or (tenant_id = public.auth_tenant_id() and public.is_admin()));
drop policy if exists reservations_client_insert on public.product_reservations;
create policy reservations_client_insert on public.product_reservations for insert
  with check (public.owns_client(client_id) and tenant_id = public.auth_tenant_id());
drop policy if exists reservations_admin on public.product_reservations;
create policy reservations_admin on public.product_reservations for all
  using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- ============================================================================
-- RPCs
-- ============================================================================
create or replace function public.return_cut(p_client_id uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare novo int;
begin
  if not (public.owns_client(p_client_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;
  update public.client_subscriptions
     set saldo_cortes = saldo_cortes + 1
   where client_id = p_client_id and status = 'ACTIVE'
   returning saldo_cortes into novo;
  return coalesce(novo, 0);
end $$;

create or replace function public.assign_combo(p_client_id uuid, p_combo_plan_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare sub_id uuid; t_id uuid; v_cuts int;
begin
  if not (public.owns_client(p_client_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;
  select tenant_id into t_id from public.clients where id = p_client_id;
  select cuts into v_cuts from public.combo_plans where id = p_combo_plan_id and tenant_id = t_id;
  if v_cuts is null then raise exception 'combo inválido'; end if;

  select id into sub_id from public.client_subscriptions where client_id = p_client_id limit 1;
  if sub_id is null then
    insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, saldo_cortes, status)
    values (t_id, p_client_id, p_combo_plan_id, v_cuts, 'ACTIVE')
    returning id into sub_id;
  else
    update public.client_subscriptions
       set combo_plan_id = p_combo_plan_id, saldo_cortes = v_cuts, status = 'ACTIVE'
     where id = sub_id;
  end if;
  return sub_id;
end $$;

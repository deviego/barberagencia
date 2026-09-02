-- ============================================================================
-- Pedidos (marketplace barbearia -> distribuidor) — Fase 2.
--   orders/order_items com RLS cross-tenant (distribuidor E barbearia veem).
--   RPCs transacionais: place_order (barbearia cria) e set_order_status
--   (distribuidor gerencia; baixa/estorno de estoque ao aceitar/cancelar).
--   Idempotente.
-- ============================================================================

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  distributor_id     uuid not null references public.tenants(id) on delete cascade,   -- distribuidor
  customer_tenant_id uuid not null references public.tenants(id) on delete cascade,   -- barbearia compradora
  status             text not null default 'PLACED' check (status in ('PLACED','CONFIRMED','SHIPPED','DELIVERED','CANCELLED')),
  total_brl          numeric(10,2) not null default 0,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_orders_distributor on public.orders(distributor_id, created_at desc);
create index if not exists idx_orders_customer on public.orders(customer_tenant_id, created_at desc);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  name       text not null,
  price_brl  numeric(10,2) not null,
  qty        integer not null check (qty > 0)
);
create index if not exists idx_order_items_order on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Distribuidor E barbearia compradora enxergam o mesmo pedido (leitura). Escrita via RPC.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select using (public.is_admin() and (distributor_id = public.auth_tenant_id() or customer_tenant_id = public.auth_tenant_id()));

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and public.is_admin()
      and (o.distributor_id = public.auth_tenant_id() or o.customer_tenant_id = public.auth_tenant_id())
  ));

-- ---- Barbearia cria o pedido (valida carteira + monta itens/total; sem baixar estoque) ----
create or replace function public.place_order(p_distributor uuid, p_items jsonb, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := public.auth_tenant_id();
  v_order uuid;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_pid uuid; v_qty int; v_name text; v_price numeric(10,2); v_active boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.distributor_customers dc
                 where dc.tenant_id = p_distributor and dc.customer_tenant_id = v_customer and dc.active) then
    raise exception 'barbearia fora da carteira deste distribuidor';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'pedido vazio'; end if;

  insert into public.orders (distributor_id, customer_tenant_id, status, total_brl, note)
    values (p_distributor, v_customer, 'PLACED', 0, nullif(btrim(coalesce(p_note,'')), ''))
    returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty < 1 then raise exception 'quantidade inválida'; end if;
    select name, price_brl, active into v_name, v_price, v_active
      from public.products where id = v_pid and tenant_id = p_distributor;
    if not found or v_active is not true then raise exception 'produto indisponível'; end if;
    insert into public.order_items (order_id, product_id, name, price_brl, qty)
      values (v_order, v_pid, v_name, v_price, v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

  update public.orders set total_brl = v_total where id = v_order;
  return v_order;
end $$;

-- ---- Muda o status (distribuidor gerencia; baixa/estorna estoque; lança extrato) ----
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := public.auth_tenant_id();
  v_o public.orders;
  it public.order_items;
begin
  select * into v_o from public.orders where id = p_order_id;
  if not found then raise exception 'pedido não encontrado'; end if;
  if not public.is_admin() then raise exception 'forbidden'; end if;

  -- autorização por papel no pedido
  if p_status in ('CONFIRMED','SHIPPED','DELIVERED') then
    if v_o.distributor_id <> v_tenant then raise exception 'forbidden'; end if;
  elsif p_status = 'CANCELLED' then
    if v_o.distributor_id <> v_tenant
       and not (v_o.customer_tenant_id = v_tenant and v_o.status = 'PLACED') then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'status inválido';
  end if;

  -- transições + estoque
  if p_status = 'CONFIRMED' then
    if v_o.status <> 'PLACED' then raise exception 'transição inválida'; end if;
    for it in select * from public.order_items where order_id = p_order_id loop
      update public.products set stock = stock - it.qty where id = it.product_id and stock >= it.qty;
      if not found then raise exception 'estoque insuficiente para %', it.name; end if;
    end loop;
  elsif p_status = 'SHIPPED' then
    if v_o.status <> 'CONFIRMED' then raise exception 'transição inválida'; end if;
  elsif p_status = 'DELIVERED' then
    if v_o.status <> 'SHIPPED' then raise exception 'transição inválida'; end if;
    insert into public.financial_entries (tenant_id, type, amount_brl, ref_kind, note, occurred_at)
      values (v_o.distributor_id, 'REVENUE', v_o.total_brl, 'order', 'Pedido ' || left(p_order_id::text, 8), now());
  elsif p_status = 'CANCELLED' then
    if v_o.status in ('CONFIRMED','SHIPPED') then
      for it in select * from public.order_items where order_id = p_order_id loop
        update public.products set stock = stock + it.qty where id = it.product_id;
      end loop;
    end if;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
end $$;

-- Permissões (o hardening schema-21 revoga por padrão; conceder explicitamente).
grant execute on function public.place_order(uuid, jsonb, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;

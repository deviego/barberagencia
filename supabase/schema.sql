-- ============================================================================
-- Barbearia White-Label — schema funcional (Supabase / Postgres + RLS)
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e execute.
-- Runtime usa supabase-js (PostgREST + RLS). snake_case p/ PostgREST.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text unique not null,
  custom_domain text unique,
  saas_plan text not null default 'personal' check (saas_plan in ('personal','essencial','advance')),
  status text not null default 'ACTIVE' check (status in ('ONBOARDING','ACTIVE','PAYMENT_PENDING','SUSPENDED')),
  created_at timestamptz not null default now()
);

create table if not exists public.branding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  logo_text text not null default 'BB',
  logo_url text,
  accent text, accent_hover text, accent_down text, accent_wash text, focus text,
  instagram text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('CLIENT','UNIT_ADMIN','NETWORK_ADMIN','MASTER')),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id, role)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true
);
create index if not exists barbers_tenant_idx on public.barbers (tenant_id);

create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday int not null,      -- 0=domingo … 6=sábado
  start_min int not null,    -- minutos desde 00:00
  end_min int not null
);
create index if not exists working_hours_barber_idx on public.working_hours (barber_id);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  duration_min int not null,
  price_brl numeric(10,2) not null,
  category text,
  active boolean not null default true
);
create index if not exists services_tenant_idx on public.services (tenant_id);

create table if not exists public.combo_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  cuts int not null,
  scope text,
  price_brl numeric(10,2) not null,
  active boolean not null default true
);
create index if not exists combo_plans_tenant_idx on public.combo_plans (tenant_id);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists clients_tenant_idx on public.clients (tenant_id);
create index if not exists clients_user_idx on public.clients (user_id);

create table if not exists public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  combo_plan_id uuid not null references public.combo_plans(id),
  saldo_cortes int not null default 0,
  billing_day int not null default 5,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAST_DUE','CANCELLED')),
  created_at timestamptz not null default now()
);
create index if not exists client_subs_tenant_idx on public.client_subscriptions (tenant_id);
create index if not exists client_subs_client_idx on public.client_subscriptions (client_id);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  barber_id uuid references public.barbers(id),
  service_id uuid references public.services(id),
  combo_plan_id uuid references public.combo_plans(id),
  start_at timestamptz not null,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','CONFIRMED','ALT_OFFERED','EXPIRED','CANCELLED','DONE')),
  request_expires_at timestamptz,
  consumed_from_plan boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists appointments_tenant_idx on public.appointments (tenant_id);
create index if not exists appointments_barber_start_idx on public.appointments (barber_id, start_at);

-- ----------------------------------------------------------------------------
-- Funções auxiliares (contexto do usuário logado)
-- ----------------------------------------------------------------------------
create or replace function public.auth_tenant_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships where user_id = auth.uid() limit 1
$$;

create or replace function public.auth_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from public.memberships where user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and role in ('UNIT_ADMIN','NETWORK_ADMIN','MASTER')
  )
$$;

create or replace function public.owns_client(cid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients c where c.id = cid and c.user_id = auth.uid())
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.tenants              enable row level security;
alter table public.branding             enable row level security;
alter table public.profiles             enable row level security;
alter table public.memberships          enable row level security;
alter table public.barbers              enable row level security;
alter table public.working_hours        enable row level security;
alter table public.services             enable row level security;
alter table public.combo_plans          enable row level security;
alter table public.clients              enable row level security;
alter table public.client_subscriptions enable row level security;
alter table public.appointments         enable row level security;

-- profiles / memberships: cada usuário vê/edita o próprio
create policy profiles_self on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());
create policy memberships_self on public.memberships
  for select using (user_id = auth.uid());

-- tenants / branding: membros do tenant leem; admin edita
create policy tenants_read on public.tenants
  for select using (id = public.auth_tenant_id());
create policy branding_read on public.branding
  for select using (tenant_id = public.auth_tenant_id());
create policy branding_admin on public.branding
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- catálogo (barbers/working_hours/services/combo_plans): membros leem; admin gerencia
create policy barbers_read on public.barbers
  for select using (tenant_id = public.auth_tenant_id());
create policy barbers_admin on public.barbers
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

create policy wh_read on public.working_hours
  for select using (exists (
    select 1 from public.barbers b where b.id = barber_id and b.tenant_id = public.auth_tenant_id()
  ));
create policy wh_admin on public.working_hours
  for all using (public.is_admin() and exists (
    select 1 from public.barbers b where b.id = barber_id and b.tenant_id = public.auth_tenant_id()
  ))
  with check (public.is_admin());

create policy services_read on public.services
  for select using (tenant_id = public.auth_tenant_id());
create policy services_admin on public.services
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

create policy combos_read on public.combo_plans
  for select using (tenant_id = public.auth_tenant_id());
create policy combos_admin on public.combo_plans
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- clients: cliente vê/edita o próprio; admin gerencia todos do tenant
create policy clients_self on public.clients
  for select using (user_id = auth.uid() or (tenant_id = public.auth_tenant_id() and public.is_admin()));
create policy clients_admin_write on public.clients
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());
create policy clients_update_self on public.clients
  for update using (user_id = auth.uid());

-- client_subscriptions: cliente vê a sua; admin gerencia
create policy subs_read on public.client_subscriptions
  for select using (public.owns_client(client_id) or (tenant_id = public.auth_tenant_id() and public.is_admin()));
create policy subs_admin on public.client_subscriptions
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- appointments: cliente lê/cria/atualiza os seus; admin gerencia todos do tenant
create policy appts_read on public.appointments
  for select using (public.owns_client(client_id) or (tenant_id = public.auth_tenant_id() and public.is_admin()));
create policy appts_client_insert on public.appointments
  for insert with check (public.owns_client(client_id) and tenant_id = public.auth_tenant_id());
create policy appts_client_update on public.appointments
  for update using (public.owns_client(client_id));
create policy appts_admin on public.appointments
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- ----------------------------------------------------------------------------
-- Trigger: auto-onboard de novos usuários como CLIENTE do tenant padrão
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  t_id uuid;
begin
  insert into public.profiles (id, full_name, phone)
    values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
    on conflict (id) do nothing;

  select id into t_id from public.tenants where subdomain = 'oliveira01' limit 1;
  if t_id is not null then
    insert into public.clients (tenant_id, user_id, name, email, phone)
      values (
        t_id, new.id,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email, new.raw_user_meta_data->>'phone'
      );
    insert into public.memberships (user_id, tenant_id, role)
      values (new.id, t_id, 'CLIENT')
      on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RPC transacional: consumir 1 corte do saldo ao agendar por plano
-- ----------------------------------------------------------------------------
create or replace function public.consume_cut(p_client_id uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare
  novo int;
begin
  update public.client_subscriptions
     set saldo_cortes = saldo_cortes - 1
   where client_id = p_client_id and status = 'ACTIVE' and saldo_cortes > 0
   returning saldo_cortes into novo;
  if novo is null then
    raise exception 'Sem saldo de cortes disponível';
  end if;
  return novo;
end $$;

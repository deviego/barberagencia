-- Crianças (filhos) do cliente + vínculo no agendamento + observações.

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  age int,
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists children_client_idx on public.children(client_id);
create index if not exists children_tenant_idx on public.children(tenant_id);

alter table public.children enable row level security;

drop policy if exists children_owner on public.children;
create policy children_owner on public.children
  for all using (public.owns_client(client_id)) with check (public.owns_client(client_id));

drop policy if exists children_admin on public.children;
create policy children_admin on public.children
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.appointments add column if not exists child_id uuid references public.children(id) on delete set null;
alter table public.appointments add column if not exists observations text;

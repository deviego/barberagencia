-- ============================================================================
-- Fila (walk-in por QR no totem). Idempotente.
--   - Flags: tenants.queue_enabled, tenant_settings.queue_pick_barber, barbers.accepts_queue
--   - queue_entries: 1 senha por cliente/dia, ordem de chegada, vira comanda ao iniciar.
--   - join_queue(): cria/retorna a senha do dia com numeração atômica por (tenant, dia).
-- ============================================================================

alter table public.tenants add column if not exists queue_enabled boolean not null default false;
alter table public.tenant_settings add column if not exists queue_pick_barber boolean not null default false;
alter table public.barbers add column if not exists accepts_queue boolean not null default true;

create table if not exists public.queue_entries (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  ticket_number  int not null,
  service_id     uuid references public.services(id),
  barber_id      uuid references public.barbers(id),
  status         text not null default 'WAITING' check (status in ('WAITING','IN_SERVICE','DONE','LEFT')),
  appointment_id uuid references public.appointments(id),
  day            date not null default (timezone('America/Sao_Paulo', now()))::date,
  joined_at      timestamptz not null default now(),
  called_at      timestamptz,
  started_at     timestamptz,
  ended_at       timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_queue_tenant_day on public.queue_entries(tenant_id, day, status);
create unique index if not exists uq_queue_ticket on public.queue_entries(tenant_id, day, ticket_number);

alter table public.queue_entries enable row level security;

-- Admin gerencia toda a fila do tenant.
drop policy if exists qe_admin on public.queue_entries;
create policy qe_admin on public.queue_entries
  for all using (tenant_id = public.auth_tenant_id() and public.is_admin())
  with check (tenant_id = public.auth_tenant_id() and public.is_admin());

-- Cliente vê a própria entrada.
drop policy if exists qe_client_read on public.queue_entries;
create policy qe_client_read on public.queue_entries
  for select using (public.owns_client(client_id));

-- ---- Entrar na fila (numeração diária atômica) ------------------------------
create or replace function public.join_queue(p_tenant_id uuid, p_service_id uuid, p_barber_id uuid)
returns public.queue_entries language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_day date := (timezone('America/Sao_Paulo', now()))::date;
  v_row public.queue_entries;
  v_ticket int;
begin
  select id into v_client from public.clients
   where user_id = auth.uid() and tenant_id = p_tenant_id
   limit 1;
  if v_client is null then raise exception 'cliente não encontrado nesta barbearia'; end if;

  -- Já está na fila hoje? retorna (atualizando serviço/barbeiro se informados).
  select * into v_row from public.queue_entries
   where tenant_id = p_tenant_id and client_id = v_client and day = v_day
     and status in ('WAITING','IN_SERVICE')
   order by joined_at limit 1;
  if found then
    update public.queue_entries
       set service_id = coalesce(p_service_id, service_id),
           barber_id  = coalesce(p_barber_id, barber_id)
     where id = v_row.id
     returning * into v_row;
    return v_row;
  end if;

  -- Próxima senha do dia.
  select coalesce(max(ticket_number), 0) + 1 into v_ticket
    from public.queue_entries where tenant_id = p_tenant_id and day = v_day;

  insert into public.queue_entries (tenant_id, client_id, ticket_number, service_id, barber_id, day)
  values (p_tenant_id, v_client, v_ticket, p_service_id, p_barber_id, v_day)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.join_queue(uuid, uuid, uuid) to authenticated;

-- ---- Cliente sai da fila -----------------------------------------------------
create or replace function public.leave_queue(p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.queue_entries
     set status = 'LEFT', ended_at = now()
   where id = p_entry_id
     and public.owns_client(client_id)
     and status = 'WAITING';
end $$;
grant execute on function public.leave_queue(uuid) to authenticated;

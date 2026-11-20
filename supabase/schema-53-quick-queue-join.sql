-- schema-53: entrar na fila pela fila rápida, com serviço e preço (#97).
-- Aditiva e re-executável. Não altera join_queue nem join_queue_totem.
--
--   1. queue_entries ganha três colunas, todas nulas ou com padrão (linhas atuais não mudam):
--        source          'QUICK_QUEUE' na senha criada pela fila rápida; null nas outras origens
--        phone_verified  false na fila rápida (telefone digitado, sem confirmação); null nas outras
--        device_id       credencial do aparelho que criou a senha (#98 lê "Minha senha" por ela)
--   2. quick_queue_join(): cria a senha do cliente que o servidor ligou à credencial do aparelho
--      no passo do telefone (#96). Só service_role. Confere tudo dentro da função:
--        - barbearia com fila e fila rápida ligadas;
--        - credencial válida, desta barbearia e com cliente desta barbearia;
--        - serviço da barbearia, ativo, com o preço que a tela mostrou (em centavos);
--        - barbeiro (se vier): a barbearia permite escolher, é dela, ativo e atende fila.
--      A numeração usa a MESMA trava por barbearia + dia de join_queue_totem (schema-50): senhas
--      do totem e da fila rápida nunca se repetem. Cliente que já tem senha ativa hoje recebe
--      EXISTING e nada muda.
--      Resultado (text): OK | EXISTING | CLOSED | NO_CLIENT | SERVICE_CHANGED | INVALID.
--      Limites e tetos ficam para a schema-54 (#99).
--
-- Rollback (nesta ordem):
--   1. voltar o código de joinQuickQueue para a versão sem RPC (responde GENERIC);
--   2. drop function if exists public.quick_queue_join(uuid, text, uuid, int, uuid);
--   3. as três colunas podem ficar: são nulas nas outras origens e nada mais as lê. Não apagar
--      (apagaria a origem das senhas da fila rápida já criadas).

-- 1) Colunas -------------------------------------------------------------------------------------
alter table public.queue_entries add column if not exists source text;
alter table public.queue_entries add column if not exists phone_verified boolean;
alter table public.queue_entries add column if not exists device_id uuid
  references public.quick_queue_devices(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'queue_entries_source_check') then
    alter table public.queue_entries
      add constraint queue_entries_source_check check (source is null or source = 'QUICK_QUEUE');
  end if;
end $$;

create index if not exists idx_queue_entries_device
  on public.queue_entries (device_id, day) where device_id is not null;

-- 2) Entrar na fila --------------------------------------------------------------------------------
create or replace function public.quick_queue_join(
  p_tenant_id   uuid,
  p_device_hash text,
  p_service_id  uuid,
  p_price_cents int,
  p_barber_id   uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day    date := (timezone('America/Sao_Paulo', now()))::date;
  v_dev    public.quick_queue_devices%rowtype;
  v_ticket int;
begin
  if p_tenant_id is null or p_service_id is null or p_price_cents is null
     or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return 'INVALID';
  end if;

  if not exists (
    select 1 from public.tenants t
     where t.id = p_tenant_id and t.queue_enabled and t.quick_queue_enabled
       and coalesce(t.kind, 'BARBERSHOP') = 'BARBERSHOP'
  ) then
    return 'CLOSED';
  end if;

  select d.* into v_dev from public.quick_queue_devices d
    join public.clients c on c.id = d.client_id and c.tenant_id = p_tenant_id
   where d.tenant_id = p_tenant_id and d.token_hash = p_device_hash and d.expires_at > now();
  if not found then
    return 'NO_CLIENT';
  end if;

  if not exists (
    select 1 from public.services s
     where s.id = p_service_id and s.tenant_id = p_tenant_id and s.active
       and round(s.price_brl * 100)::int = p_price_cents
  ) then
    return 'SERVICE_CHANGED';
  end if;

  if p_barber_id is not null and not exists (
    select 1 from public.barbers b
      join public.tenant_settings ts on ts.tenant_id = b.tenant_id and ts.queue_pick_barber
     where b.id = p_barber_id and b.tenant_id = p_tenant_id and b.active and b.accepts_queue
  ) then
    return 'SERVICE_CHANGED';
  end if;

  -- Mesma trava de join_queue_totem: uma senha por vez por barbearia + dia.
  perform pg_advisory_xact_lock(hashtextextended('queue_ticket:' || p_tenant_id::text || ':' || v_day::text, 0));

  if exists (
    select 1 from public.queue_entries
     where tenant_id = p_tenant_id and client_id = v_dev.client_id and day = v_day
       and status in ('WAITING', 'IN_SERVICE')
  ) then
    return 'EXISTING';
  end if;

  select coalesce(max(ticket_number), 0) + 1 into v_ticket
    from public.queue_entries where tenant_id = p_tenant_id and day = v_day;

  insert into public.queue_entries
    (tenant_id, client_id, ticket_number, service_id, barber_id, day, source, phone_verified, device_id)
  values
    (p_tenant_id, v_dev.client_id, v_ticket, p_service_id, p_barber_id, v_day, 'QUICK_QUEUE', false, v_dev.id);

  update public.quick_queue_devices set last_used_at = now() where id = v_dev.id;
  return 'OK';
end $$;

revoke execute on function public.quick_queue_join(uuid, text, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.quick_queue_join(uuid, text, uuid, int, uuid) to service_role;

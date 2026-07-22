-- ============================================================================
-- Barbearia White-Label — schema v4 (aditivo). Rode DEPOIS de schema.sql/2/3.
-- Realtime em appointments + RPC de horários ocupados (para o cliente ver
-- os slots indisponíveis ao agendar). Idempotente.
-- ============================================================================

-- ---- Realtime na tabela de agendamentos (para o painel admin reagir) -------
do $$
begin
  begin
    alter publication supabase_realtime add table public.appointments;
  exception when duplicate_object then null;  -- já está na publicação
  end;
end $$;

-- ---- RPC: start_at ocupados de um barbeiro num intervalo (sem PII) ---------
create or replace function public.booked_starts(
  p_barber_id uuid, p_from timestamptz, p_to timestamptz
) returns setof timestamptz
  language sql stable security definer set search_path = public as $$
  select start_at from public.appointments
   where barber_id = p_barber_id
     and start_at >= p_from and start_at < p_to
     and status in ('REQUESTED','CONFIRMED','ALT_OFFERED')
$$;

grant execute on function public.booked_starts(uuid, timestamptz, timestamptz) to authenticated;

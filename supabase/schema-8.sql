-- ============================================================================
-- Barbearia White-Label — schema v8 (aditivo). Comanda ao vivo: cronômetro de
-- atendimento + duração dos itens. Idempotente.
-- ============================================================================
alter table public.appointments add column if not exists service_started_at timestamptz;
alter table public.appointments add column if not exists service_ended_at timestamptz;
alter table public.appointment_items add column if not exists duration_min int not null default 0;

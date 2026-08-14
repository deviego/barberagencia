-- ============================================================================
-- Corrige o padrão do modo da fila: APP (QR/app do cliente) é o padrão.
-- O Totem é opt-in — só quem tem um totem ativa. Idempotente.
-- ============================================================================

alter table public.tenant_settings alter column queue_mode set default 'APP';

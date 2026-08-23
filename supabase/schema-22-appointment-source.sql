-- ============================================================================
-- Canal de origem do agendamento (App / Balcão / Totem)
--   Para o relatório responder "os clientes estão agendando pelo app?".
--   Idempotente. Não apaga dado. Histórico fica NULL ("não informado").
--
-- ORDEM DE APLICAÇÃO: aplicar ANTES de subir o código que grava/lê `source`
-- (o código atual NÃO referencia esta coluna; a leitura precisa passa a valer
--  numa etapa seguinte, após esta migração estar no banco).
-- ============================================================================
alter table public.appointments
  add column if not exists source text
  check (source in ('APP','BALCAO','TOTEM'));

comment on column public.appointments.source is
  'Canal de criação do agendamento: APP (cliente), BALCAO (admin/recepção), TOTEM (fila). NULL = histórico anterior ao rastreamento.';

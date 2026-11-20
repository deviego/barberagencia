-- schema-51: chave da fila rápida por barbearia (story #95).
-- Aditiva e idempotente (pode rodar mais de uma vez). Compatível com o código em produção:
-- o código atual não lê a coluna, e o código novo trata a coluna ausente como desligada.
--
-- Segurança:
--   * Padrão desligado: nenhuma barbearia muda de comportamento ao aplicar.
--   * Fica em public.tenants, que tem RLS ligada e nenhuma policy de escrita: só o servidor
--     (service role) liga ou desliga. O painel da barbearia não grava esta coluna direto
--     (o liga/desliga com as regras dele é da #102).
--
-- Rollback: alter table public.tenants drop column if exists quick_queue_enabled;
--   (só enquanto nenhuma barbearia estiver com a fila rápida ligada)

alter table public.tenants
  add column if not exists quick_queue_enabled boolean not null default false;

comment on column public.tenants.quick_queue_enabled is
  'Fila rápida (link do cliente sem conta). Padrão desligado; só o servidor altera.';

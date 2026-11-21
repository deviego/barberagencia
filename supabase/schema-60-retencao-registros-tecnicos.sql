-- schema-60: retenção dos registros técnicos de limite de tentativas (#108).
-- Aditiva e re-executável. Decisão do Diego (16/11 e 20/11): 7 dias, só registros técnicos.
--
-- Cria public.purge_technical_records(), que faz SÓ estes três comandos, sempre com filtro de data:
--   1. apaga de rate_limit_events as linhas com created_at há mais de 7 dias;
--   2. apaga de quick_queue_identify_attempts as linhas com created_at há mais de 7 dias;
--   3. em quick_queue_devices, zera pending_phone_key e pending_until quando pending_until já
--      passou. Nenhuma linha de aparelho é apagada; nenhuma outra coluna muda.
-- O prazo é fixo dentro da função (sem parâmetro): quem chama não consegue encurtar a retenção.
-- Nenhuma outra tabela é tocada: nada de cliente, senha da fila ou dado de negócio.
-- Execução: 1x por dia pelo agendador do wa-gateway (service role), log só com as contagens.
--
-- Rollback (nesta ordem):
--   1. tirar o agendamento do wa-gateway (bloco "Retenção dos registros técnicos" em index.js);
--   2. drop function if exists public.purge_technical_records();

create or replace function public.purge_technical_records()
returns table (rate_limit_events_deleted int, identify_attempts_deleted int, pending_phones_cleared int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - interval '7 days';
  v_now    timestamptz := now();
begin
  delete from public.rate_limit_events
   where created_at < v_cutoff;
  get diagnostics rate_limit_events_deleted = row_count;

  delete from public.quick_queue_identify_attempts
   where created_at < v_cutoff;
  get diagnostics identify_attempts_deleted = row_count;

  update public.quick_queue_devices
     set pending_phone_key = null,
         pending_until     = null
   where pending_until is not null
     and pending_until <= v_now;
  get diagnostics pending_phones_cleared = row_count;

  return next;
end $$;

revoke execute on function public.purge_technical_records() from public, anon, authenticated;
grant execute on function public.purge_technical_records() to service_role;

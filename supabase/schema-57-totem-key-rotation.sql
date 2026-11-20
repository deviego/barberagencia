-- schema-57: renovar a chave do totem na adoção da fila rápida (#103). Aditiva e re-executável.
--
--   tenants.totem_key_rotated_at / totem_key_rotated_by: última renovação da chave do totem
--     (quem e quando). A chave nunca entra em registro: o histórico vai para audit_log sem ela.
--   tenant_settings.quick_queue_adoption_started_at: primeira vez que o dono pediu para ligar a
--     fila rápida. Regra no servidor (setQuickQueueEnabled): ligar só é aceito com uma
--     renovação registrada DEPOIS desse momento (decisão da revisão de segurança, todas as
--     barbearias, sem exceção).
-- Nada aqui toca em queue_entries: renovar não mexe em senha nenhuma.
--
-- Rollback: voltar o código de setQuickQueueEnabled e de regenerateTotemToken para a versão
-- sem estas colunas. As colunas podem ficar (nulas); não apagar (guardam quem renovou).

alter table public.tenants add column if not exists totem_key_rotated_at timestamptz;
alter table public.tenants add column if not exists totem_key_rotated_by uuid references auth.users(id) on delete set null;
alter table public.tenant_settings add column if not exists quick_queue_adoption_started_at timestamptz;

-- ============================================================================
-- schema v13 (aditivo). Marca itens adicionados DEPOIS do agendamento inicial
-- (via addComandaItem/addComandaItemClient) para separar "Serviços" x "Adicionais".
-- ============================================================================
alter table public.appointment_items add column if not exists added_later boolean not null default false;

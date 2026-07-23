-- ============================================================================
-- Barbearia White-Label — schema v6 (aditivo). Realtime para reservas de produto
-- (para o painel admin ser notificado quando o cliente solicita uma retirada).
-- Idempotente.
-- ============================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.product_reservations;
  exception when duplicate_object then null;
  end;
end $$;

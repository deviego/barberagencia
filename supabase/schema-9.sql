-- ============================================================================
-- Barbearia White-Label — schema v9 (aditivo). O cliente pode remover itens que
-- adicionou à própria comanda (enquanto não iniciada e não coberta pelo plano).
-- Inserir já é permitido pela policy appt_items_client_insert. Idempotente.
-- ============================================================================
drop policy if exists appt_items_client_delete on public.appointment_items;
create policy appt_items_client_delete on public.appointment_items for delete
  using (
    not covered_by_plan
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and public.owns_client(a.client_id)
        and a.service_started_at is null
        and a.status in ('REQUESTED', 'CONFIRMED', 'ALT_OFFERED')
    )
  );

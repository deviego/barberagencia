-- ============================================================================
-- Catálogo REAL da Barbearia Oliveira 01 (produção). Zera dados de teste + insere
-- os serviços da tabela oficial e os 2 planos. Rodar via pooler.
-- ============================================================================
do $$
declare t_id uuid;
begin
  select id into t_id from public.tenants where subdomain = 'oliveira01';
  if t_id is null then raise exception 'tenant oliveira01 não encontrado'; end if;

  -- 1) Zerar dados transacionais de teste (ordem segura de FK)
  delete from public.appointment_items;
  delete from public.appointments;
  delete from public.plan_requests;
  delete from public.client_subscriptions;
  delete from public.product_reservations;
  delete from public.sale_items;
  delete from public.sales;
  delete from public.payments;
  delete from public.financial_entries;
  delete from public.notification_log;
  delete from public.campaigns;

  -- 2) Zerar catálogo antigo
  delete from public.services where tenant_id = t_id;
  delete from public.combo_plans where tenant_id = t_id;
  delete from public.products where tenant_id = t_id;

  -- 3) Serviços reais (nome, duração min, preço, categoria)
  insert into public.services (tenant_id, name, duration_min, price_brl, category, active) values
    (t_id, 'Combo Corte + Barba + Sobrancelha', 60, 60, 'Combo', true),
    (t_id, 'Corte Tesoura', 45, 40, 'Corte', true),
    (t_id, 'Corte Degradê ou Disfarçado', 45, 35, 'Corte', true),
    (t_id, 'Corte Máquina Simples', 30, 25, 'Corte', true),
    (t_id, 'Corte Navalhado', 45, 35, 'Corte', true),
    (t_id, 'Barba Simples ou Modelada', 30, 25, 'Barba', true),
    (t_id, 'Corte Infantil', 40, 40, 'Corte', true),
    (t_id, 'Sobrancelha', 15, 10, 'Sobrancelha', true),
    (t_id, 'Acabamento', 15, 10, 'Corte', true),
    (t_id, 'Pigmentação', 30, 20, 'Estética', true),
    (t_id, 'Pigmentação Barba', 30, 20, 'Estética', true),
    (t_id, 'Nevou / Reflexo', 90, 100, 'Estética', true),
    (t_id, 'Limpeza Facial', 30, 20, 'Estética', true);

  -- 4) Planos (combos) — adesão e desconto no texto (scope)
  insert into public.combo_plans (tenant_id, name, cuts, scope, price_brl, active) values
    (t_id, 'Plano 1', 4, '5% de desconto nos produtos · adesão R$ 90', 140, true),
    (t_id, 'Plano 2 · Corte + Barba + Sobrancelha', 4,
       'corte + barba + sobrancelha · 10% de desconto nos produtos · adesão R$ 180', 220, true);
end $$;

import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";

/** Solicitações de agendamento (REQUESTED) do tenant do admin. */
export async function listRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, start_at, status, request_expires_at, consumed_from_plan, payment_method, observations, clients(name, phone), barbers(name), services(name), combo_plans(name), children(name, age), appointment_items(kind, name, price_brl, qty, covered_by_plan)"
    )
    .eq("status", "REQUESTED")
    .order("start_at", { ascending: true });
  return data ?? [];
}

/** Métricas do dashboard (reais). */
export async function getDashboard() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [rev, revDay, apptsToday, subs, pending, sixRev, today] = await Promise.all([
    supabase.from("financial_entries").select("amount_brl").eq("type", "REVENUE").gte("occurred_at", monthStart.toISOString()),
    supabase.from("financial_entries").select("amount_brl").eq("type", "REVENUE").gte("occurred_at", dayStart.toISOString()).lt("occurred_at", dayEnd.toISOString()),
    supabase.from("appointments").select("id", { count: "exact", head: true }).gte("start_at", dayStart.toISOString()).lt("start_at", dayEnd.toISOString()),
    supabase.from("client_subscriptions").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
    supabase.from("financial_entries").select("amount_brl, occurred_at").eq("type", "REVENUE").gte("occurred_at", sixStart.toISOString()),
    getTodayAppointments(),
  ]);

  const revenueMonth = (rev.data ?? []).reduce((s, r) => s + Number(r.amount_brl), 0);
  const revenueToday = (revDay.data ?? []).reduce((s, r) => s + Number(r.amount_brl), 0);
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), value: 0, current: i === 5 };
  });
  for (const e of sixRev.data ?? []) {
    const d = new Date(e.occurred_at as string);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff >= 0 && diff <= 5) buckets[5 - diff].value += Number(e.amount_brl);
  }

  return {
    revenueToday,
    revenueMonth,
    apptsToday: apptsToday.count ?? 0,
    subscribers: subs.count ?? 0,
    pending: pending.count ?? 0,
    revenue6m: buckets,
    today,
  };
}

/** Financeiro de um período (reais). Sem args = mês corrente. */
export async function getFinance(fromISO?: string, toISO?: string) {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const from = fromISO ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let query = supabase
    .from("financial_entries")
    .select("type, amount_brl, method, occurred_at")
    .gte("occurred_at", from);
  if (toISO) query = query.lt("occurred_at", toISO);
  const { data } = await query.order("occurred_at", { ascending: false });
  const rows = (data ?? []) as { type: string; amount_brl: number; method: string | null; occurred_at: string }[];

  const revenue = rows.filter((r) => r.type === "REVENUE").reduce((s, r) => s + Number(r.amount_brl), 0);
  const expenses = rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + Number(r.amount_brl), 0);
  const withdrawals = rows.filter((r) => r.type === "WITHDRAWAL").reduce((s, r) => s + Number(r.amount_brl), 0);

  const methodMap: Record<string, string> = { PIX: "PIX", CARD_CREDIT: "Cartão", CARD_DEBIT: "Cartão", CASH: "Dinheiro", PLAN: "Plano" };
  const byMethodAcc: Record<string, number> = {};
  for (const r of rows.filter((r) => r.type === "REVENUE")) {
    const key = methodMap[r.method ?? ""] ?? "Outros";
    byMethodAcc[key] = (byMethodAcc[key] ?? 0) + Number(r.amount_brl);
  }
  const colors: Record<string, string> = { PIX: "var(--bb-success)", Cartão: "var(--bb-accent)", Dinheiro: "var(--bb-info)", Plano: "var(--bb-n500)", Outros: "var(--bb-n500)" };
  const byMethod = Object.entries(byMethodAcc).map(([method, val]) => ({
    method,
    val,
    pct: revenue > 0 ? Math.round((val / revenue) * 100) : 0,
    color: colors[method] ?? "var(--bb-n500)",
  }));

  const receipts = rows.filter((r) => r.type === "REVENUE").slice(0, 8);
  return { revenue, expenses, closing: revenue - expenses, withdrawals, byMethod, receipts };
}

type Row = Record<string, unknown>;
const relOne = (rel: unknown): Row | null => (Array.isArray(rel) ? ((rel[0] as Row) ?? null) : ((rel as Row) ?? null));

/**
 * Detalhamento do financeiro num período: recebimentos com cliente + serviços, e
 * o ranking de serviços mais vendidos (%). Fonte = `sales`/`sale_items` (todo
 * recebimento passa por createSale). Service-role escopado ao tenant da sessão.
 */
export async function getFinanceDetails(fromISO: string, toISO: string) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { receipts: [], services: [] as ServiceStat[] };
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("sales")
    .select("id, total_brl, created_at, clients(name), payments(method), sale_items(name, qty, kind, price_brl)")
    .eq("tenant_id", user.tenantId)
    .gte("created_at", fromISO)
    .lt("created_at", toISO)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const receipts = rows.slice(0, 40).map((s) => ({
    datetime: s.created_at as string,
    clientName: (relOne(s.clients)?.name as string) ?? "Cliente avulso",
    method: (relOne(s.payments)?.method as string) ?? null,
    total: Number(s.total_brl ?? 0),
    items: ((s.sale_items as Row[]) ?? []).map((it) => ({ name: it.name as string, qty: Number(it.qty ?? 1), kind: it.kind as string })),
  }));

  const acc: Record<string, { name: string; value: number; qty: number }> = {};
  for (const s of rows) {
    for (const it of (s.sale_items as Row[]) ?? []) {
      if (it.kind !== "service") continue;
      const name = (it.name as string) ?? "Serviço";
      (acc[name] ??= { name, value: 0, qty: 0 });
      acc[name].value += Number(it.price_brl ?? 0) * Number(it.qty ?? 1);
      acc[name].qty += Number(it.qty ?? 1);
    }
  }
  const totalSvc = Object.values(acc).reduce((a, s) => a + s.value, 0);
  const services: ServiceStat[] = Object.values(acc)
    .map((s) => ({ ...s, pct: totalSvc > 0 ? Math.round((s.value / totalSvc) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  return { receipts, services };
}
export type ServiceStat = { name: string; value: number; qty: number; pct: number };

/**
 * Faturamento por barbeiro num período (base = agendamentos do barbeiro, com os
 * itens de serviço). Receita = itens NÃO cobertos por plano (o que entra no caixa).
 * Não inclui vendas de balcão sem barbeiro. Service-role escopado ao tenant.
 */
export async function getFinanceByBarber(fromISO: string, toISO: string) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { barbers: [] as BarberFinanceRow[], detailed: [] as BarberReceipt[] };
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("id, start_at, barber_id, payment_method, clients(name), barbers(name), appointment_items(name, qty, price_brl, kind, covered_by_plan)")
    .eq("tenant_id", user.tenantId)
    .gte("start_at", fromISO)
    .lt("start_at", toISO)
    .neq("status", "CANCELLED")
    .order("start_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const summary = new Map<string, BarberFinanceRow>();
  const detailed: BarberReceipt[] = [];
  for (const a of rows) {
    if (!a.barber_id) continue;
    const items = (a.appointment_items as Row[]) ?? [];
    const revenue = items.reduce((s, it) => s + (it.covered_by_plan ? 0 : Number(it.price_brl ?? 0) * Number(it.qty ?? 1)), 0);
    const bid = a.barber_id as string;
    const bname = (relOne(a.barbers)?.name as string) ?? "Barbeiro";
    const cur = summary.get(bid) ?? { id: bid, name: bname, appts: 0, revenue: 0 };
    cur.appts += 1;
    cur.revenue += revenue;
    summary.set(bid, cur);
    detailed.push({
      barberId: bid,
      datetime: a.start_at as string,
      clientName: (relOne(a.clients)?.name as string) ?? "Cliente",
      method: (a.payment_method as string) ?? null,
      total: revenue,
      items: items.filter((it) => it.kind === "service").map((it) => ({ name: it.name as string, qty: Number(it.qty ?? 1) })),
    });
  }
  return { barbers: [...summary.values()].sort((a, b) => b.revenue - a.revenue), detailed };
}
export type BarberFinanceRow = { id: string; name: string; appts: number; revenue: number };
export type BarberReceipt = { barberId: string; datetime: string; clientName: string; method: string | null; total: number; items: { name: string; qty: number }[] };

export async function getCampaigns() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, segment, status, reach, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCombos() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("combo_plans")
    .select("id, name, cuts, price_brl, booking_mode")
    .eq("active", true)
    .order("name");
  return data ?? [];
}

export async function getBranding() {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return null;
  const { data } = await supabase
    .from("branding")
    .select("logo_text, logo_url, accent, instagram")
    .eq("tenant_id", user.tenantId)
    .maybeSingle();
  return data;
}

/** Configurações da unidade (contato/horários) + flag de onboarding, do tenant do admin. */
export async function getUnitSettings() {
  const supabase = await createSupabaseServerClient();
  const user = await getSessionUser();
  if (!user?.tenantId) return null;
  const { data } = await supabase
    .from("tenant_settings")
    .select("phone, address, hours_weekday, hours_saturday, onboarded_at, onboarding_snoozed_at")
    .eq("tenant_id", user.tenantId)
    .maybeSingle();
  return data;
}

/** Cancelamentos recentes (para o painel de cancelamentos/reembolsos). */
export async function getRecentCancellations() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, consumed_from_plan, clients(name), services(name), combo_plans(name)")
    .in("status", ["CANCELLED", "EXPIRED"])
    .order("start_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

/** Leitores de CRUD (admin, sob RLS do tenant). */
export async function getServices() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, duration_min, price_brl, category, is_child_service, active")
    .order("name");
  return data ?? [];
}
export async function getProducts() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, sku, price_brl, cost_brl, stock, image_url, active")
    .order("name");
  return data ?? [];
}
export async function getComboPlans() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("combo_plans")
    .select("id, name, cuts, scope, price_brl, booking_mode, service_id, forfeit_on_noshow, active")
    .order("name");
  return data ?? [];
}
export async function getBarbers() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("barbers").select("id, name, active").order("name");
  return data ?? [];
}
export async function getClients() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, email, phone, active, status, children(id)")
    .order("name");
  return (data ?? []).map((c) => {
    const kids = (c.children ?? []) as { id: string }[];
    const { children: _children, ...rest } = c as typeof c & { children?: unknown };
    void _children;
    return { ...rest, children_count: kids.length };
  });
}

/** Agenda num intervalo [from, to) — usada pela navegação por dia/semana. */
export async function getAgenda(fromISO: string, toISO: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, status, no_show, barber_id, observations, clients(name), services(name), combo_plans(name), children(name, age), appointment_items(kind, name, price_brl, qty, covered_by_plan)")
    .gte("start_at", fromISO)
    .lt("start_at", toISO)
    .order("start_at", { ascending: true });
  return data ?? [];
}

/** Horários de trabalho dos barbeiros do tenant (para gerar slots no admin). */
export async function getWorkingHours() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("working_hours")
    .select("barber_id, weekday, start_min, end_min");
  return data ?? [];
}

/** Espaçamento (min) entre horários da agenda. Default 30, limitado a 5–120. */
export async function getSlotStep(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tenant_settings").select("slot_step_min").maybeSingle();
  const v = Number(data?.slot_step_min ?? 30);
  return Number.isFinite(v) ? Math.min(120, Math.max(5, v)) : 30;
}

/** Planos (combos) com os serviços do combo e os clientes vinculados (para o gerenciador). */
export async function getPlansManage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: plans }, { data: cps }, { data: subs }] = await Promise.all([
    supabase
      .from("combo_plans")
      .select("id, name, cuts, scope, price_brl, booking_mode, forfeit_on_noshow, active")
      .order("name"),
    supabase.from("combo_plan_services").select("combo_plan_id, service_id"),
    supabase.from("client_subscriptions").select("combo_plan_id, saldo_cortes, clients(name, phone)").eq("status", "ACTIVE"),
  ]);
  const svcByPlan = new Map<string, string[]>();
  for (const r of (cps ?? []) as Row[]) {
    const k = r.combo_plan_id as string;
    svcByPlan.set(k, [...(svcByPlan.get(k) ?? []), r.service_id as string]);
  }
  const subsByPlan = new Map<string, { name: string; phone: string | null; saldo: number }[]>();
  for (const r of (subs ?? []) as Row[]) {
    const k = r.combo_plan_id as string;
    const c = relOne(r.clients);
    subsByPlan.set(k, [
      ...(subsByPlan.get(k) ?? []),
      { name: (c?.name as string) ?? "Cliente", phone: (c?.phone as string) ?? null, saldo: Number(r.saldo_cortes ?? 0) },
    ]);
  }
  return ((plans ?? []) as Row[]).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    cuts: Number(p.cuts ?? 0),
    scope: (p.scope as string) ?? null,
    priceBrl: Number(p.price_brl ?? 0),
    bookingMode: (p.booking_mode as string) ?? "FLEXIBLE",
    forfeitOnNoshow: !!p.forfeit_on_noshow,
    active: p.active !== false,
    serviceIds: svcByPlan.get(p.id as string) ?? [],
    subscribers: subsByPlan.get(p.id as string) ?? [],
  }));
}
export type PlanManageRow = Awaited<ReturnType<typeof getPlansManage>>[number];

/** Bloqueios/folgas futuros da agenda (barber_id null = barbearia inteira). */
export async function getScheduleBlocks() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("schedule_blocks")
    .select("id, barber_id, starts_at, ends_at, reason, barbers(name)")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return (data ?? []) as {
    id: string;
    barber_id: string | null;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    barbers: { name: string } | { name: string }[] | null;
  }[];
}

/** Clientes ativos com o plano ativo (para o "Novo agendamento" vincular o combo). */
export async function getClientsWithPlan() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, client_subscriptions(combo_plan_id, saldo_cortes, status, combo_plans(name, cuts))")
    .eq("active", true)
    .order("name");
  return (data ?? []).map((c) => {
    const subs = (c.client_subscriptions ?? []) as {
      combo_plan_id: string;
      saldo_cortes: number;
      status: string;
      combo_plans: { name: string; cuts: number } | { name: string; cuts: number }[] | null;
    }[];
    const active = subs.find((s) => s.status === "ACTIVE");
    const combo = active
      ? Array.isArray(active.combo_plans)
        ? active.combo_plans[0]
        : active.combo_plans
      : null;
    return {
      id: c.id as string,
      name: c.name as string,
      plan: active ? { comboPlanId: active.combo_plan_id, name: combo?.name ?? "Plano", saldo: active.saldo_cortes } : null,
    };
  });
}

/** Pedidos de plano pendentes (troca/cancelamento) do tenant. */
export async function getPlanRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("plan_requests")
    .select("id, type, created_at, combo_plan_id, client_id, clients(name), combo_plans(name, booking_mode)")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Contagem de itens pendentes (agendamentos + pedidos de plano + retiradas de produto). */
export async function getPendingCount() {
  const supabase = await createSupabaseServerClient();
  const [appts, plans, reservas] = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
    supabase.from("plan_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("product_reservations").select("id", { count: "exact", head: true }).eq("status", "RESERVED"),
  ]);
  return (appts.count ?? 0) + (plans.count ?? 0) + (reservas.count ?? 0);
}

/** Retiradas de produto pendentes (RESERVED) do tenant. */
export async function getProductReservations() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("product_reservations")
    .select("id, qty, created_at, clients(name), products(name, price_brl)")
    .eq("status", "RESERVED")
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Comandas de hoje (confirmadas, em atendimento e finalizadas) para a aba Pedidos. */
export async function getComandas() {
  const supabase = await createSupabaseServerClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, start_at, status, service_started_at, service_ended_at, payment_method, barber_id, observations, clients(name), barbers(name), children(name, age), appointment_items(id, kind, name, price_brl, qty, covered_by_plan, duration_min)"
    )
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .in("status", ["CONFIRMED", "DONE"])
    .order("start_at", { ascending: true });
  return data ?? [];
}

/** Detalhe do cliente: dados + plano ativo + histórico de serviços. */
export async function getClientDetail(id: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { data: sub }, { data: history }] = await Promise.all([
    supabase.from("clients").select("id, name, email, phone, active, avatar_url").eq("id", id).maybeSingle(),
    supabase
      .from("client_subscriptions")
      .select("saldo_cortes, status, fixed_weekday, fixed_start_min, combo_plans(name, cuts, price_brl, booking_mode)")
      .eq("client_id", id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, start_at, status, consumed_from_plan, services(name), combo_plans(name), barbers(name)")
      .eq("client_id", id)
      .order("start_at", { ascending: false })
      .limit(20),
  ]);
  const { data: children } = await supabase
    .from("children")
    .select("id, name, age, photo_url")
    .eq("client_id", id)
    .order("created_at", { ascending: true });
  return { client, sub, history: history ?? [], children: children ?? [] };
}

/** Agenda do dia (todos os status ativos) do tenant. */
export async function getTodayAppointments() {
  const supabase = await createSupabaseServerClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, status, no_show, barber_id, clients(name), services(name), combo_plans(name), appointment_items(kind, name, price_brl, qty, covered_by_plan)")
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .order("start_at", { ascending: true });
  return data ?? [];
}

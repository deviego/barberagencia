import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Solicitações de agendamento (REQUESTED) do tenant do admin. */
export async function listRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, start_at, status, request_expires_at, consumed_from_plan, clients(name), barbers(name), services(name), combo_plans(name), appointment_items(kind, name, price_brl, qty, covered_by_plan)"
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

  const [rev, apptsToday, subs, pending, sixRev, today] = await Promise.all([
    supabase.from("financial_entries").select("amount_brl").eq("type", "REVENUE").gte("occurred_at", monthStart.toISOString()),
    supabase.from("appointments").select("id", { count: "exact", head: true }).gte("start_at", dayStart.toISOString()).lt("start_at", dayEnd.toISOString()),
    supabase.from("client_subscriptions").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
    supabase.from("financial_entries").select("amount_brl, occurred_at").eq("type", "REVENUE").gte("occurred_at", sixStart.toISOString()),
    getTodayAppointments(),
  ]);

  const revenueMonth = (rev.data ?? []).reduce((s, r) => s + Number(r.amount_brl), 0);
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
    revenueMonth,
    apptsToday: apptsToday.count ?? 0,
    subscribers: subs.count ?? 0,
    pending: pending.count ?? 0,
    revenue6m: buckets,
    today,
  };
}

/** Financeiro do mês (reais). */
export async function getFinance() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const { data } = await supabase
    .from("financial_entries")
    .select("type, amount_brl, method, occurred_at")
    .gte("occurred_at", monthStart.toISOString())
    .order("occurred_at", { ascending: false });
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
    .select("id, name, cuts, price_brl")
    .eq("active", true)
    .order("name");
  return data ?? [];
}

export async function getBranding() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("branding")
    .select("logo_text, logo_url, accent, instagram")
    .limit(1)
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
    .select("id, name, duration_min, price_brl, category, active")
    .order("name");
  return data ?? [];
}
export async function getProducts() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, sku, price_brl, cost_brl, stock, active")
    .order("name");
  return data ?? [];
}
export async function getComboPlans() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("combo_plans")
    .select("id, name, cuts, scope, price_brl, active")
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
    .select("id, name, email, phone, active")
    .order("name");
  return data ?? [];
}

/** Agenda num intervalo [from, to) — usada pela navegação por dia/semana. */
export async function getAgenda(fromISO: string, toISO: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, status, no_show, barber_id, clients(name), services(name), combo_plans(name), appointment_items(kind, name, price_brl, qty, covered_by_plan)")
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
    .select("id, type, created_at, clients(name), combo_plans(name)")
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

/** Detalhe do cliente: dados + plano ativo + histórico de serviços. */
export async function getClientDetail(id: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { data: sub }, { data: history }] = await Promise.all([
    supabase.from("clients").select("id, name, email, phone, active, avatar_url").eq("id", id).maybeSingle(),
    supabase
      .from("client_subscriptions")
      .select("saldo_cortes, status, combo_plans(name, cuts, price_brl)")
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
  return { client, sub, history: history ?? [] };
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

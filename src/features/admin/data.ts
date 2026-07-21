import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Solicitações de agendamento (REQUESTED) do tenant do admin. */
export async function listRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, start_at, status, request_expires_at, consumed_from_plan, clients(name), barbers(name), services(name), combo_plans(name)"
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

/** Agenda do dia (todos os status ativos) do tenant. */
export async function getTodayAppointments() {
  const supabase = await createSupabaseServerClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, status, no_show, barber_id, clients(name), services(name), combo_plans(name)")
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .order("start_at", { ascending: true });
  return data ?? [];
}

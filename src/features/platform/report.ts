import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeSaasPlan } from "@/lib/entitlements";

type Row = Record<string, any>;
const num = (v: any) => Number(v ?? 0);

export type ServiceRow = { name: string; qty: number; value: number };

export type BarbershopReport = {
  tenantId: string;
  name: string;
  phone: string | null;
  period: { label: string; startISO: string; endISO: string };
  totalClients: number;
  newClients: number;
  subscribers: number;
  appointments: number;
  entradas: number;
  saidas: number;
  byMethod: { method: string; total: number }[];
  byService: ServiceRow[];
  newClientsList: { name: string; phone: string | null; date: string }[];
};

export type MonthlyReport = {
  period: { label: string; startISO: string; endISO: string };
  byService: ServiceRow[];
  platform: {
    barbershops: number;
    activeBarbershops: number;
    byPlan: { personal: number; essencial: number; advance: number };
    clients: number;
    newClients: number;
    subscribers: number;
    entradas: number;
    saidas: number;
    liquido: number;
    byMethod: { method: string; total: number }[];
    topClients: { name: string; tenantName: string; total: number }[];
  };
  perBarbershop: {
    id: string;
    name: string;
    plan: string;
    clients: number;
    newClients: number;
    subscribers: number;
    entradas: number;
    saidas: number;
  }[];
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CARD_CREDIT: "Cartão crédito",
  CARD_DEBIT: "Cartão débito",
  CASH: "Dinheiro",
  PLAN: "Plano",
};

/** Relatório mensal consolidado da plataforma + por barbearia. Mês de referência: `ref` (ou o atual). */
export async function getMonthlyReport(ref?: Date): Promise<MonthlyReport> {
  const admin = createSupabaseAdminClient();
  const base = ref ?? new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0);
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const [tenantsRes, clientsRes, subsRes, finRes] = await Promise.all([
    admin.from("tenants").select("id, name, saas_plan, status"),
    admin.from("clients").select("id, name, tenant_id, created_at"),
    admin.from("client_subscriptions").select("tenant_id, status"),
    admin.from("financial_entries").select("tenant_id, type, amount_brl, method, ref_client, occurred_at").gte("occurred_at", startISO).lt("occurred_at", endISO),
  ]);

  const tenants = (tenantsRes.data ?? []) as Row[];
  const clients = (clientsRes.data ?? []) as Row[];
  const subs = (subsRes.data ?? []) as Row[];
  const fins = (finRes.data ?? []) as Row[];

  const tenantName = new Map(tenants.map((t) => [t.id, t.name as string]));
  const clientName = new Map(clients.map((c) => [c.id, c.name as string]));
  const clientTenant = new Map(clients.map((c) => [c.id, c.tenant_id as string]));

  // Plataforma
  const byPlan = { personal: 0, essencial: 0, advance: 0 };
  for (const t of tenants) byPlan[normalizeSaasPlan(t.saas_plan)]++;
  const activeSubs = subs.filter((s) => s.status === "ACTIVE");
  const newClients = clients.filter((c) => c.created_at >= startISO && c.created_at < endISO).length;

  let entradas = 0;
  let saidas = 0;
  const methodMap = new Map<string, number>();
  const clientRevMap = new Map<string, number>();
  for (const f of fins) {
    const amt = num(f.amount_brl);
    if (f.type === "REVENUE") {
      entradas += amt;
      const m = (f.method as string) ?? "—";
      methodMap.set(m, (methodMap.get(m) ?? 0) + amt);
      if (f.ref_client) clientRevMap.set(f.ref_client, (clientRevMap.get(f.ref_client) ?? 0) + amt);
    } else {
      saidas += amt;
    }
  }

  const byMethod = [...methodMap.entries()]
    .map(([method, total]) => ({ method: METHOD_LABEL[method] ?? method, total }))
    .sort((a, b) => b.total - a.total);
  const topClients = [...clientRevMap.entries()]
    .map(([cid, total]) => ({ name: clientName.get(cid) ?? "Cliente", tenantName: tenantName.get(clientTenant.get(cid) ?? "") ?? "", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // Por barbearia
  const clientsBy = new Map<string, number>();
  const newBy = new Map<string, number>();
  for (const c of clients) {
    clientsBy.set(c.tenant_id, (clientsBy.get(c.tenant_id) ?? 0) + 1);
    if (c.created_at >= startISO && c.created_at < endISO) newBy.set(c.tenant_id, (newBy.get(c.tenant_id) ?? 0) + 1);
  }
  const subsBy = new Map<string, number>();
  for (const s of activeSubs) subsBy.set(s.tenant_id, (subsBy.get(s.tenant_id) ?? 0) + 1);
  const entBy = new Map<string, number>();
  const saiBy = new Map<string, number>();
  for (const f of fins) {
    const amt = num(f.amount_brl);
    if (f.type === "REVENUE") entBy.set(f.tenant_id, (entBy.get(f.tenant_id) ?? 0) + amt);
    else saiBy.set(f.tenant_id, (saiBy.get(f.tenant_id) ?? 0) + amt);
  }

  const perBarbershop = tenants
    .map((t) => ({
      id: t.id as string,
      name: t.name as string,
      plan: normalizeSaasPlan(t.saas_plan),
      clients: clientsBy.get(t.id) ?? 0,
      newClients: newBy.get(t.id) ?? 0,
      subscribers: subsBy.get(t.id) ?? 0,
      entradas: entBy.get(t.id) ?? 0,
      saidas: saiBy.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.entradas - a.entradas);

  const byService = await servicesBreakdown(admin, null, startISO, endISO);

  return {
    period: { label, startISO, endISO },
    byService,
    platform: {
      barbershops: tenants.length,
      activeBarbershops: tenants.filter((t) => (t.status ?? "ACTIVE") === "ACTIVE").length,
      byPlan,
      clients: clients.length,
      newClients,
      subscribers: activeSubs.length,
      entradas,
      saidas,
      liquido: entradas - saidas,
      byMethod,
      topClients,
    },
    perBarbershop,
  };
}

/** Faturamento/serviços realizados por serviço, em um período (opcionalmente por barbearia). */
async function servicesBreakdown(admin: any, tenantId: string | null, fromISO: string, toISO: string): Promise<ServiceRow[]> {
  const map = new Map<string, { qty: number; value: number }>();
  const add = (name: string, qty: number, value: number) => {
    const k = name || "Serviço";
    const cur = map.get(k) ?? { qty: 0, value: 0 };
    cur.qty += qty;
    cur.value += value;
    map.set(k, cur);
  };

  // Itens de comanda (agendamentos) — não cobertos pelo plano contam como faturamento.
  let aq = admin
    .from("appointment_items")
    .select("name, price_brl, qty, covered_by_plan, tenant_id, created_at")
    .eq("kind", "service")
    .gte("created_at", fromISO)
    .lt("created_at", toISO);
  if (tenantId) aq = aq.eq("tenant_id", tenantId);
  const aRes = await aq;
  for (const r of (aRes.data ?? []) as Row[]) {
    const qty = num(r.qty) || 1;
    add(r.name as string, qty, r.covered_by_plan ? 0 : num(r.price_brl) * qty);
  }

  // Itens de venda (PDV/balcão).
  let sq = admin.from("sales").select("id, tenant_id, created_at").gte("created_at", fromISO).lt("created_at", toISO);
  if (tenantId) sq = sq.eq("tenant_id", tenantId);
  const salesRes = await sq;
  const saleIds = ((salesRes.data ?? []) as Row[]).map((s) => s.id);
  if (saleIds.length) {
    const siRes = await admin.from("sale_items").select("name, price_brl, qty, kind, sale_id").eq("kind", "service").in("sale_id", saleIds);
    for (const r of (siRes.data ?? []) as Row[]) {
      const qty = num(r.qty) || 1;
      add(r.name as string, qty, num(r.price_brl) * qty);
    }
  }

  return [...map.entries()].map(([name, v]) => ({ name, qty: v.qty, value: v.value })).sort((a, b) => b.value - a.value);
}

/** Relatório de UMA barbearia num período (de/até). Padrão: mês atual. */
export async function getBarbershopReport(tenantId: string, from?: Date, to?: Date): Promise<BarbershopReport | null> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const start = from ?? new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const end = to ?? new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const label = `${start.toLocaleDateString("pt-BR")} — ${new Date(end.getTime() - 86400000).toLocaleDateString("pt-BR")}`;

  const { data: t } = await admin.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();
  if (!t) return null;
  const { data: settings } = await admin.from("tenant_settings").select("phone").eq("tenant_id", tenantId).maybeSingle();

  const [clientsRes, newRes, subsRes, apptRes, finRes, byService] = await Promise.all([
    admin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("clients").select("id, name, phone, created_at").eq("tenant_id", tenantId).gte("created_at", startISO).lt("created_at", endISO).order("created_at"),
    admin.from("client_subscriptions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "ACTIVE"),
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("start_at", startISO).lt("start_at", endISO).neq("status", "CANCELLED"),
    admin.from("financial_entries").select("type, amount_brl, method, occurred_at").eq("tenant_id", tenantId).gte("occurred_at", startISO).lt("occurred_at", endISO),
    servicesBreakdown(admin, tenantId, startISO, endISO),
  ]);

  const fins = (finRes.data ?? []) as Row[];
  let entradas = 0;
  let saidas = 0;
  const methodMap = new Map<string, number>();
  for (const f of fins) {
    const amt = num(f.amount_brl);
    if (f.type === "REVENUE") {
      entradas += amt;
      const m = (f.method as string) ?? "—";
      methodMap.set(m, (methodMap.get(m) ?? 0) + amt);
    } else saidas += amt;
  }
  const byMethod = [...methodMap.entries()].map(([method, total]) => ({ method: METHOD_LABEL[method] ?? method, total })).sort((a, b) => b.total - a.total);
  const newList = ((newRes.data ?? []) as Row[]).map((c) => ({
    name: c.name as string,
    phone: (c.phone as string) ?? null,
    date: new Date(c.created_at as string).toLocaleDateString("pt-BR"),
  }));

  return {
    tenantId,
    name: t.name as string,
    phone: (settings?.phone as string) ?? null,
    period: { label, startISO, endISO },
    totalClients: clientsRes.count ?? 0,
    newClients: newList.length,
    subscribers: subsRes.count ?? 0,
    appointments: apptRes.count ?? 0,
    entradas,
    saidas,
    byMethod,
    byService,
    newClientsList: newList,
  };
}

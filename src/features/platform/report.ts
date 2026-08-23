import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeSaasPlan } from "@/lib/entitlements";

type Row = Record<string, any>;
const num = (v: any) => Number(v ?? 0);

export type ServiceRow = { name: string; qty: number; value: number };
export type NamedTotal = { name: string; total: number };
export type BarberRow = { name: string; appts: number; revenue: number };
export type CampaignRow = { name: string; segment: string; status: string; reach: number; date: string };
export type ApptRow = { datetime: string; clientName: string; serviceName: string; barberName: string; status: string };
export type PeakBucket = { label: string; count: number };
export type Peak = { busiestHour: string; busiestWeekday: string; hours: PeakBucket[]; weekdays: PeakBucket[] };
export type SourceSplit = { fila: number; outros: number; total: number };
export type PlanRow = { name: string; subscribers: number; priceBrl: number; mrr: number };
export type SubUsage = { clientName: string; planName: string; total: number; used: number; saldo: number };
export type ProductRow = { name: string; priceBrl: number; stock: number; active: boolean };

export type Growth = { value: number; prev: number; pct: number | null };

export type BarbershopReport = {
  tenantId: string;
  name: string;
  phone: string | null;
  period: { label: string; startISO: string; endISO: string };
  prevPeriodLabel: string;
  totalClients: number;
  newClients: number;
  subscribers: number;
  appointments: number;
  entradas: number;
  saidas: number;
  liquido: number;
  ticketMedio: number;
  mrr: number;
  growth: { entradas: Growth; newClients: Growth; appointments: Growth };
  byMethod: { method: string; total: number }[];
  byService: ServiceRow[];
  byProduct: ServiceRow[];
  topClients: { name: string; total: number; count: number }[];
  subscribersList: { clientName: string; planName: string; priceBrl: number }[];
  daily: { date: string; entradas: number; saidas: number }[];
  newClientsList: { name: string; phone: string | null; date: string }[];
  expensesByCategory: NamedTotal[];
  campaigns: CampaignRow[];
  queue: { total: number; done: number; left: number };
  byBarber: BarberRow[];
  peak: Peak;
  bySource: SourceSplit;
  recentAppointments: ApptRow[];
  saasPlan: string;
  saasTrial: string | null;
  plans: PlanRow[];
  planCoveredAppts: number;
  subscribersUsage: SubUsage[];
  productsCatalog: ProductRow[];
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

const APPT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Solicitado",
  CONFIRMED: "Confirmado",
  SCHEDULED: "Agendado",
  IN_SERVICE: "Em atendimento",
  DONE: "Concluído",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Faltou",
};

const WEEKDAY_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAY_EN_IDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const TZ = "America/Sao_Paulo";

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

  const byService = await itemsBreakdown(admin, null, startISO, endISO, "service");

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

/** Itens realizados por nome (serviço OU produto), num período (opcionalmente por barbearia). */
async function itemsBreakdown(
  admin: any,
  tenantId: string | null,
  fromISO: string,
  toISO: string,
  kind: "service" | "product",
): Promise<ServiceRow[]> {
  const fallback = kind === "product" ? "Produto" : "Serviço";
  const map = new Map<string, { qty: number; value: number }>();
  const add = (name: string, qty: number, value: number) => {
    const k = name || fallback;
    const cur = map.get(k) ?? { qty: 0, value: 0 };
    cur.qty += qty;
    cur.value += value;
    map.set(k, cur);
  };

  // Itens de comanda (agendamentos) — cobertos pelo plano não contam como faturamento.
  let aq = admin
    .from("appointment_items")
    .select("name, price_brl, qty, covered_by_plan, tenant_id, created_at")
    .eq("kind", kind)
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
    const siRes = await admin.from("sale_items").select("name, price_brl, qty, kind, sale_id").eq("kind", kind).in("sale_id", saleIds);
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

  // Período anterior de mesmo tamanho (para crescimento).
  const lenMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - lenMs);
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = startISO;
  const prevLabel = `${prevStart.toLocaleDateString("pt-BR")} — ${new Date(start.getTime() - 86400000).toLocaleDateString("pt-BR")}`;

  const { data: t } = await admin.from("tenants").select("id, name, saas_plan").eq("id", tenantId).maybeSingle();
  if (!t) return null;
  const { data: settings } = await admin.from("tenant_settings").select("phone").eq("tenant_id", tenantId).maybeSingle();
  const { data: contract } = await admin
    .from("tenant_contracts")
    .select("trial_enabled, trial_ends_at, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const startDayStr = start.toISOString().slice(0, 10);
  const endDayStr = end.toISOString().slice(0, 10);

  const [
    clientsRes,
    clientNamesRes,
    newRes,
    prevNewRes,
    subsRes,
    apptRes,
    prevApptRes,
    finRes,
    prevFinRes,
    byService,
    byProduct,
    barbersRes,
    servicesRes,
    apptListRes,
    campaignsRes,
    queueRes,
    productsRes,
    planCoveredRes,
  ] = await Promise.all([
    admin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("clients").select("id, name").eq("tenant_id", tenantId),
    admin.from("clients").select("id, name, phone, created_at").eq("tenant_id", tenantId).gte("created_at", startISO).lt("created_at", endISO).order("created_at"),
    admin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", prevStartISO).lt("created_at", prevEndISO),
    admin
      .from("client_subscriptions")
      .select("id, status, saldo_cortes, combo_plan_id, clients(name), combo_plans(name, price_brl, cuts)")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE"),
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("start_at", startISO).lt("start_at", endISO).neq("status", "CANCELLED"),
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("start_at", prevStartISO).lt("start_at", prevEndISO).neq("status", "CANCELLED"),
    admin.from("financial_entries").select("type, amount_brl, method, ref_client, ref_barber, ref_kind, note, occurred_at").eq("tenant_id", tenantId).gte("occurred_at", startISO).lt("occurred_at", endISO),
    admin.from("financial_entries").select("type, amount_brl").eq("tenant_id", tenantId).eq("type", "REVENUE").gte("occurred_at", prevStartISO).lt("occurred_at", prevEndISO),
    itemsBreakdown(admin, tenantId, startISO, endISO, "service"),
    itemsBreakdown(admin, tenantId, startISO, endISO, "product"),
    admin.from("barbers").select("id, name").eq("tenant_id", tenantId),
    admin.from("services").select("id, name").eq("tenant_id", tenantId),
    admin.from("appointments").select("id, start_at, status, barber_id, service_id, client_id").eq("tenant_id", tenantId).gte("start_at", startISO).lt("start_at", endISO).neq("status", "CANCELLED").order("start_at", { ascending: false }),
    admin.from("campaigns").select("name, segment, status, reach, scheduled_at, created_at").eq("tenant_id", tenantId).gte("created_at", startISO).lt("created_at", endISO).order("created_at", { ascending: false }),
    admin.from("queue_entries").select("status, appointment_id").eq("tenant_id", tenantId).gte("day", startDayStr).lt("day", endDayStr),
    admin.from("products").select("name, price_brl, stock, active").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("consumed_from_plan", true).gte("start_at", startISO).lt("start_at", endISO).neq("status", "CANCELLED"),
  ]);

  const clientName = new Map(((clientNamesRes.data ?? []) as Row[]).map((c) => [c.id as string, c.name as string]));
  const barberName = new Map(((barbersRes.data ?? []) as Row[]).map((b) => [b.id as string, b.name as string]));
  const serviceName = new Map(((servicesRes.data ?? []) as Row[]).map((s) => [s.id as string, s.name as string]));

  const fins = (finRes.data ?? []) as Row[];
  let entradas = 0;
  let saidas = 0;
  const methodMap = new Map<string, number>();
  const clientRev = new Map<string, { total: number; count: number }>();
  const dayMap = new Map<string, { entradas: number; saidas: number }>();
  const expenseMap = new Map<string, number>();
  const barberRev = new Map<string, number>();
  for (const f of fins) {
    const amt = num(f.amount_brl);
    const dayKey = new Date(f.occurred_at as string).toISOString().slice(0, 10);
    const day = dayMap.get(dayKey) ?? { entradas: 0, saidas: 0 };
    if (f.type === "REVENUE") {
      entradas += amt;
      day.entradas += amt;
      const m = (f.method as string) ?? "—";
      methodMap.set(m, (methodMap.get(m) ?? 0) + amt);
      if (f.ref_client) {
        const cur = clientRev.get(f.ref_client) ?? { total: 0, count: 0 };
        cur.total += amt;
        cur.count += 1;
        clientRev.set(f.ref_client, cur);
      }
      if (f.ref_barber) barberRev.set(f.ref_barber, (barberRev.get(f.ref_barber) ?? 0) + amt);
    } else {
      saidas += amt;
      day.saidas += amt;
      const cat = (f.ref_kind as string) || (f.note as string) || "Outros";
      expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + amt);
    }
    dayMap.set(dayKey, day);
  }

  const byMethod = [...methodMap.entries()].map(([method, total]) => ({ method: METHOD_LABEL[method] ?? method, total })).sort((a, b) => b.total - a.total);
  const expensesByCategory = [...expenseMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  const topClients = [...clientRev.entries()]
    .map(([cid, v]) => ({ name: clientName.get(cid) ?? "Cliente", total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const daily = [...dayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([d, v]) => ({ date: new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR"), entradas: v.entradas, saidas: v.saidas }));

  const subsRows = (subsRes.data ?? []) as Row[];
  const planAgg = new Map<string, { name: string; subscribers: number; priceBrl: number }>();
  const subscribersList: { clientName: string; planName: string; priceBrl: number }[] = [];
  const subscribersUsage: SubUsage[] = [];
  for (const s of subsRows) {
    const client = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    const plan = Array.isArray(s.combo_plans) ? s.combo_plans[0] : s.combo_plans;
    const clientNm = (client?.name as string) ?? "Cliente";
    const planNm = (plan?.name as string) ?? "Plano";
    const price = num(plan?.price_brl);
    const totalCuts = num(plan?.cuts);
    const saldo = num(s.saldo_cortes);
    subscribersList.push({ clientName: clientNm, planName: planNm, priceBrl: price });
    subscribersUsage.push({ clientName: clientNm, planName: planNm, total: totalCuts, used: Math.max(0, totalCuts - saldo), saldo });
    const key = (s.combo_plan_id as string) ?? planNm;
    const agg = planAgg.get(key) ?? { name: planNm, subscribers: 0, priceBrl: price };
    agg.subscribers += 1;
    planAgg.set(key, agg);
  }
  const mrr = subscribersList.reduce((a, s) => a + s.priceBrl, 0);
  const plans: PlanRow[] = [...planAgg.values()]
    .map((p) => ({ name: p.name, subscribers: p.subscribers, priceBrl: p.priceBrl, mrr: p.priceBrl * p.subscribers }))
    .sort((a, b) => b.mrr - a.mrr);

  const productsCatalog: ProductRow[] = ((productsRes.data ?? []) as Row[]).map((p) => ({
    name: p.name as string,
    priceBrl: num(p.price_brl),
    stock: num(p.stock),
    active: p.active === true,
  }));
  const planCoveredAppts = planCoveredRes.count ?? 0;

  const newList = ((newRes.data ?? []) as Row[]).map((c) => ({
    name: c.name as string,
    phone: (c.phone as string) ?? null,
    date: new Date(c.created_at as string).toLocaleDateString("pt-BR"),
  }));

  const appointments = apptRes.count ?? 0;
  const ticketMedio = appointments > 0 ? entradas / appointments : 0;

  // --- Agendamentos: por barbeiro, pico (hora/dia) e últimos ---
  const apptRows = (apptListRes.data ?? []) as Row[];
  const barberAppts = new Map<string, number>();
  const hourCounts = new Array(24).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  for (const a of apptRows) {
    if (a.barber_id) barberAppts.set(a.barber_id, (barberAppts.get(a.barber_id) ?? 0) + 1);
    const d = new Date(a.start_at as string);
    const h = parseInt(d.toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }), 10);
    if (!Number.isNaN(h) && h >= 0 && h < 24) hourCounts[h] += 1;
    const wi = WEEKDAY_EN_IDX[d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" })] ?? 0;
    weekdayCounts[wi] += 1;
  }

  const byBarber: BarberRow[] = [...new Set([...barberAppts.keys(), ...barberRev.keys()])]
    .map((id) => ({ name: barberName.get(id) ?? "Barbeiro", appts: barberAppts.get(id) ?? 0, revenue: barberRev.get(id) ?? 0 }))
    .sort((a, b) => b.appts - a.appts || b.revenue - a.revenue);

  const maxHour = hourCounts.reduce((mi, c, i, arr) => (c > arr[mi] ? i : mi), 0);
  const maxWd = weekdayCounts.reduce((mi, c, i, arr) => (c > arr[mi] ? i : mi), 0);
  const peak: Peak = {
    busiestHour: appointments > 0 && hourCounts[maxHour] > 0 ? `${String(maxHour).padStart(2, "0")}h–${String(maxHour + 1).padStart(2, "0")}h` : "—",
    busiestWeekday: appointments > 0 && weekdayCounts[maxWd] > 0 ? WEEKDAY_PT[maxWd] : "—",
    hours: hourCounts.map((count, h) => ({ label: `${String(h).padStart(2, "0")}h`, count })).filter((b) => b.count > 0),
    weekdays: weekdayCounts.map((count, i) => ({ label: WEEKDAY_PT[i], count })).filter((b) => b.count > 0),
  };

  const recentAppointments: ApptRow[] = apptRows.slice(0, 12).map((a) => {
    const d = new Date(a.start_at as string);
    return {
      datetime: d.toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      clientName: clientName.get(a.client_id as string) ?? "Cliente",
      serviceName: serviceName.get(a.service_id as string) ?? "—",
      barberName: barberName.get(a.barber_id as string) ?? "—",
      status: APPT_STATUS_LABEL[a.status as string] ?? (a.status as string) ?? "—",
    };
  });

  // --- Canal do agendamento (detectável hoje: via fila x demais) ---
  const queueRows = (queueRes.data ?? []) as Row[];
  const queueApptIds = new Set(queueRows.map((q) => q.appointment_id).filter(Boolean));
  const fila = apptRows.filter((a) => queueApptIds.has(a.id)).length;
  const bySource: SourceSplit = { fila, outros: apptRows.length - fila, total: apptRows.length };

  const queue = {
    total: queueRows.length,
    done: queueRows.filter((q) => q.status === "DONE").length,
    left: queueRows.filter((q) => q.status === "LEFT").length,
  };

  // --- Campanhas do período ---
  const campaigns: CampaignRow[] = ((campaignsRes.data ?? []) as Row[]).map((c) => ({
    name: (c.name as string) ?? "Campanha",
    segment: (c.segment as string) ?? "—",
    status: (c.status as string) ?? "—",
    reach: num(c.reach),
    date: new Date((c.scheduled_at as string) ?? (c.created_at as string)).toLocaleDateString("pt-BR"),
  }));

  // Crescimento vs período anterior.
  const prevEntradas = ((prevFinRes.data ?? []) as Row[]).reduce((a, f) => a + num(f.amount_brl), 0);
  const prevNew = prevNewRes.count ?? 0;
  const prevAppt = prevApptRes.count ?? 0;
  const growthOf = (value: number, prev: number): Growth => ({
    value,
    prev,
    pct: prev > 0 ? ((value - prev) / prev) * 100 : null,
  });

  // Plano (SaaS) da barbearia + status de teste.
  const SAAS_LABEL: Record<string, string> = { personal: "Personal", essencial: "Essencial", advance: "Advance" };
  const saasPlan = SAAS_LABEL[normalizeSaasPlan(t.saas_plan)] ?? (t.saas_plan as string) ?? "—";
  let saasTrial: string | null = null;
  if (contract?.trial_enabled && contract?.trial_ends_at) {
    const ends = new Date(contract.trial_ends_at as string);
    if (ends.getTime() > Date.now()) saasTrial = `Em teste até ${ends.toLocaleDateString("pt-BR")}`;
  }

  return {
    tenantId,
    name: t.name as string,
    phone: (settings?.phone as string) ?? null,
    period: { label, startISO, endISO },
    prevPeriodLabel: prevLabel,
    totalClients: clientsRes.count ?? 0,
    newClients: newList.length,
    subscribers: subscribersList.length,
    appointments,
    entradas,
    saidas,
    liquido: entradas - saidas,
    ticketMedio,
    mrr,
    growth: {
      entradas: growthOf(entradas, prevEntradas),
      newClients: growthOf(newList.length, prevNew),
      appointments: growthOf(appointments, prevAppt),
    },
    byMethod,
    byService,
    byProduct,
    topClients,
    subscribersList,
    daily,
    newClientsList: newList,
    expensesByCategory,
    campaigns,
    queue,
    byBarber,
    peak,
    bySource,
    recentAppointments,
    saasPlan,
    saasTrial,
    plans,
    planCoveredAppts,
    subscribersUsage,
    productsCatalog,
  };
}

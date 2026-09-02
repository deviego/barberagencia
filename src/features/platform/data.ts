import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDistributorPlan } from "@/lib/entitlements";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export type Bar = { month: string; value: number; current?: boolean };

/** Últimos 6 meses (inclui o atual), com rótulo curto pt-BR. */
function last6Months() {
  const now = new Date();
  const out: { label: string; year: number; month: number; endMs: number; current: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); // início do mês seguinte
    out.push({
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      year: d.getFullYear(),
      month: d.getMonth(),
      endMs: end,
      current: i === 0,
    });
  }
  return out;
}

function inSameMonth(iso: string | null | undefined, ref = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Soma por mês (bucket do mês de `dateField`). */
function sumByMonth(rows: Row[], dateField: string, valueField: string): Bar[] {
  const months = last6Months();
  return months.map((m) => {
    const value = rows.reduce((acc, r) => {
      const d = r[dateField] ? new Date(r[dateField]) : null;
      if (d && d.getFullYear() === m.year && d.getMonth() === m.month) return acc + num(r[valueField]);
      return acc;
    }, 0);
    return { month: m.label, value, current: m.current };
  });
}

/** Contagem acumulada até o fim de cada mês (curva de crescimento). */
function cumulativeByMonth(rows: Row[], dateField: string): Bar[] {
  const months = last6Months();
  return months.map((m) => {
    const value = rows.reduce((acc, r) => {
      const d = r[dateField] ? new Date(r[dateField]).getTime() : null;
      return d !== null && d < m.endMs ? acc + 1 : acc;
    }, 0);
    return { month: m.label, value, current: m.current };
  });
}

/* -------------------------------------------------------------------------- */
/*  Dashboard da plataforma                                                    */
/* -------------------------------------------------------------------------- */

export async function getPlatformStats() {
  const admin = createSupabaseAdminClient();
  const [tenantsRes, revenueRes, subsRes, plansRes] = await Promise.all([
    admin.from("tenants").select("id, status, created_at, saas_plan"),
    admin.from("financial_entries").select("amount_brl, occurred_at").eq("type", "REVENUE"),
    admin.from("client_subscriptions").select("status, combo_plan_id, created_at"),
    admin.from("combo_plans").select("id, price_brl"),
  ]);

  const tenants = ((tenantsRes.data ?? []) as Row[]).filter((t) => !isDistributorPlan(t.saas_plan as string));
  const revenue = (revenueRes.data ?? []) as Row[];
  const subs = (subsRes.data ?? []) as Row[];
  const plans = (plansRes.data ?? []) as Row[];

  const planPrice = new Map<string, number>(plans.map((p) => [p.id as string, num(p.price_brl)]));
  const activeSubs = subs.filter((s) => s.status === "ACTIVE");

  const revenueTotal = revenue.reduce((a, r) => a + num(r.amount_brl), 0);
  const revenueMonth = revenue.filter((r) => inSameMonth(r.occurred_at)).reduce((a, r) => a + num(r.amount_brl), 0);
  const mrr = activeSubs.reduce((a, s) => a + (planPrice.get(s.combo_plan_id as string) ?? 0), 0);

  return {
    barbershops: tenants.length,
    activeBarbershops: tenants.filter((t) => t.status === "ACTIVE").length,
    subscribers: activeSubs.length,
    revenueTotal,
    revenueMonth,
    mrr,
    barbershops6m: cumulativeByMonth(tenants, "created_at"),
    subscribers6m: cumulativeByMonth(activeSubs, "created_at"),
    revenue6m: sumByMonth(revenue, "occurred_at", "amount_brl"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Lista de barbearias (enriquecida)                                          */
/* -------------------------------------------------------------------------- */

/** Lista todas as barbearias (tenants) com contagens e faturamento — visão do Master (service-role). */
export async function getTenants() {
  const admin = createSupabaseAdminClient();
  const [tenantsRes, clientsRes, barbersRes, subsRes, revenueRes] = await Promise.all([
    admin.from("tenants").select("id, name, subdomain, saas_plan, status, created_at").order("created_at", { ascending: true }),
    admin.from("clients").select("tenant_id"),
    admin.from("barbers").select("tenant_id, active"),
    admin.from("client_subscriptions").select("tenant_id, status"),
    admin.from("financial_entries").select("tenant_id, amount_brl, occurred_at").eq("type", "REVENUE"),
  ]);

  const tenants = ((tenantsRes.data ?? []) as Row[]).filter((t) => !isDistributorPlan(t.saas_plan as string));
  const countBy = (rows: Row[] | null, pred?: (r: Row) => boolean) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (pred && !pred(r)) continue;
      m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
    }
    return m;
  };
  const clientsBy = countBy(clientsRes.data as Row[]);
  const barbersBy = countBy(barbersRes.data as Row[], (r) => r.active === true);
  const subsBy = countBy(subsRes.data as Row[], (r) => r.status === "ACTIVE");

  const revenueBy = new Map<string, number>();
  for (const r of (revenueRes.data ?? []) as Row[]) {
    if (!inSameMonth(r.occurred_at)) continue;
    revenueBy.set(r.tenant_id, (revenueBy.get(r.tenant_id) ?? 0) + num(r.amount_brl));
  }

  return tenants.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    subdomain: t.subdomain as string,
    saasPlan: (t.saas_plan as string) ?? "advance",
    status: (t.status as string) ?? "ACTIVE",
    clients: clientsBy.get(t.id) ?? 0,
    barbers: barbersBy.get(t.id) ?? 0,
    subscribers: subsBy.get(t.id) ?? 0,
    revenueMonth: revenueBy.get(t.id) ?? 0,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Detalhe de uma barbearia                                                   */
/* -------------------------------------------------------------------------- */

export async function getTenantDetail(id: string) {
  const admin = createSupabaseAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, subdomain, saas_plan, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) return null;

  const [brandingRes, settingsRes, clientsRes, barbersRes, servicesRes, productsRes, revenueRes, subsRes] =
    await Promise.all([
      admin.from("branding").select("logo_text, logo_url").eq("tenant_id", id).maybeSingle(),
      admin.from("tenant_settings").select("phone, address, hours_weekday, hours_saturday").eq("tenant_id", id).maybeSingle(),
      admin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", id),
      admin.from("barbers").select("id", { count: "exact", head: true }).eq("tenant_id", id).eq("active", true),
      admin.from("services").select("id, name, duration_min, price_brl, active").eq("tenant_id", id).order("name"),
      admin.from("products").select("id, name, price_brl, stock, active").eq("tenant_id", id).is("deleted_at", null).order("name"),
      admin.from("financial_entries").select("amount_brl, occurred_at").eq("tenant_id", id).eq("type", "REVENUE"),
      admin
        .from("client_subscriptions")
        .select("id, status, clients(name), combo_plans(name, price_brl)")
        .eq("tenant_id", id)
        .eq("status", "ACTIVE"),
    ]);

  const revenue = (revenueRes.data ?? []) as Row[];
  const revenueTotal = revenue.reduce((a, r) => a + num(r.amount_brl), 0);
  const revenueMonth = revenue.filter((r) => inSameMonth(r.occurred_at)).reduce((a, r) => a + num(r.amount_brl), 0);

  const services = ((servicesRes.data ?? []) as Row[]).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    durationMin: num(s.duration_min),
    priceBrl: num(s.price_brl),
    active: s.active === true,
  }));
  const products = ((productsRes.data ?? []) as Row[]).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    priceBrl: num(p.price_brl),
    stock: num(p.stock),
    active: p.active === true,
  }));
  const subscribers = ((subsRes.data ?? []) as Row[]).map((s) => {
    const client = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    const plan = Array.isArray(s.combo_plans) ? s.combo_plans[0] : s.combo_plans;
    return {
      id: s.id as string,
      clientName: (client?.name as string) ?? "Cliente",
      planName: (plan?.name as string) ?? "Plano",
      priceBrl: num(plan?.price_brl),
    };
  });

  const settings = settingsRes.data as Row | null;

  return {
    id: tenant.id as string,
    name: tenant.name as string,
    subdomain: tenant.subdomain as string,
    saasPlan: (tenant.saas_plan as string) ?? "advance",
    status: (tenant.status as string) ?? "ACTIVE",
    createdAt: tenant.created_at as string,
    logoText: (brandingRes.data?.logo_text as string) ?? null,
    logoUrl: (brandingRes.data?.logo_url as string) ?? null,
    phone: (settings?.phone as string) ?? null,
    address: (settings?.address as string) ?? null,
    hoursWeekday: (settings?.hours_weekday as string) ?? null,
    hoursSaturday: (settings?.hours_saturday as string) ?? null,
    counts: {
      clients: clientsRes.count ?? 0,
      barbers: barbersRes.count ?? 0,
      services: services.length,
      products: products.length,
      subscribers: subscribers.length,
    },
    revenueTotal,
    revenueMonth,
    revenue6m: sumByMonth(revenue, "occurred_at", "amount_brl"),
    services,
    products,
    subscribers,
  };
}

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeSaasPlan } from "@/lib/entitlements";

type Row = Record<string, any>;
const num = (v: any) => Number(v ?? 0);

export type MonthlyReport = {
  period: { label: string; startISO: string; endISO: string };
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

  return {
    period: { label, startISO, endISO },
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

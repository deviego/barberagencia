import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { PLANS, normalizeSaasPlan, planLabel, isDistributorPlan, distributorPlanInfo } from "@/lib/entitlements";

export type SaasPaymentRow = {
  amountBrl: number;
  method: string | null;
  paidAt: string;
  paidUntil: string | null;
  note: string | null;
};

export type SaasBillingState = "TRIAL" | "ACTIVE" | "OVERDUE" | "SUSPENDED" | "UNKNOWN";

export type SaasBilling = {
  plan: string;
  planLabel: string;
  priceBrl: number;
  tenantStatus: string;
  trialEndsAt: string | null;
  trialActive: boolean;
  paidUntil: string | null;
  state: SaasBillingState;
  overdue: boolean;
  payments: SaasPaymentRow[];
  configured: boolean; // migração schema-23 aplicada?
};

const num = (v: unknown) => Number(v ?? 0);

/** Estado de cobrança da mensalidade do SaaS (MASTER). Degrada se schema-23 não aplicado. */
export async function getSaasBilling(tenantId: string): Promise<SaasBilling | null> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return null;

  const admin = createSupabaseAdminClient();
  const { data: t } = await admin.from("tenants").select("saas_plan, status").eq("id", tenantId).maybeSingle();
  const rawPlan = (t?.saas_plan as string | undefined) ?? null;
  const isDist = isDistributorPlan(rawPlan);
  const planKey = isDist ? (rawPlan as string) : normalizeSaasPlan(rawPlan);
  const priceBrl = isDist ? distributorPlanInfo(rawPlan).priceBRL : PLANS[normalizeSaasPlan(rawPlan)].priceBRL;
  const planLbl = isDist ? distributorPlanInfo(rawPlan).label : planLabel(normalizeSaasPlan(rawPlan));

  // Contrato: trial + paid_until (paid_until pode não existir se a migração não rodou).
  let trialEndsAt: string | null = null;
  let paidUntil: string | null = null;
  let paidUntilKnown = true;
  const cRes = await admin
    .from("tenant_contracts")
    .select("trial_ends_at, paid_until")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (cRes.error) {
    paidUntilKnown = false;
    const c2 = await admin.from("tenant_contracts").select("trial_ends_at").eq("tenant_id", tenantId).maybeSingle();
    trialEndsAt = (c2.data?.trial_ends_at as string) ?? null;
  } else {
    trialEndsAt = (cRes.data?.trial_ends_at as string) ?? null;
    paidUntil = (cRes.data?.paid_until as string) ?? null;
  }

  // Histórico de pagamentos (tabela pode não existir).
  const pRes = await admin
    .from("saas_payments")
    .select("amount_brl, method, paid_at, paid_until, note")
    .eq("tenant_id", tenantId)
    .order("paid_at", { ascending: false })
    .limit(24);
  const tableExists = !pRes.error;
  const payments: SaasPaymentRow[] = tableExists
    ? ((pRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        amountBrl: num(r.amount_brl),
        method: (r.method as string) ?? null,
        paidAt: r.paid_at as string,
        paidUntil: (r.paid_until as string) ?? null,
        note: (r.note as string) ?? null,
      }))
    : [];

  const now = Date.now();
  const trialActive = !!trialEndsAt && new Date(trialEndsAt).getTime() > now;
  const paidActive = !!paidUntil && new Date(paidUntil).getTime() >= now;
  const overdue = !!paidUntil && !paidActive && !trialActive;
  const tenantStatus = (t?.status as string) ?? "ACTIVE";

  let state: SaasBillingState = "UNKNOWN";
  if (tenantStatus === "SUSPENDED") state = "SUSPENDED";
  else if (paidActive) state = "ACTIVE";
  else if (trialActive) state = "TRIAL";
  else if (overdue) state = "OVERDUE";

  return {
    plan: planKey,
    planLabel: planLbl,
    priceBrl,
    tenantStatus,
    trialEndsAt,
    trialActive,
    paidUntil,
    state,
    overdue,
    payments,
    configured: paidUntilKnown && tableExists,
  };
}

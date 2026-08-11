import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  PLANS,
  hasEntitlement,
  getLimit,
  isUnlimited,
  minPlanForFeature,
  minPlanForLimit,
  normalizeSaasPlan,
  planLabel,
  type FeatureKey,
  type NumericLimitKey,
} from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";

export type EffectivePlan = {
  plan: SaasPlanKey;
  gated: boolean; // true = limites/recursos do plano valem (o teste acabou)
  trialEndsAt: string | null;
  tenantId: string | null;
};

/** Plano efetivo da barbearia atual: durante o teste, gated=false (tudo liberado). */
export async function getEffectivePlan(): Promise<EffectivePlan> {
  const user = await getSessionUser();
  const supabase = await createSupabaseServerClient();
  const [{ data: c }, { data: t }] = await Promise.all([
    supabase.from("tenant_contracts").select("plan, trial_ends_at").maybeSingle(),
    supabase.from("tenants").select("saas_plan").maybeSingle(),
  ]);
  const plan = normalizeSaasPlan((t?.saas_plan as string) ?? (c?.plan as string) ?? null);
  const trialEndsAt = (c?.trial_ends_at as string) ?? null;
  const gated = trialEndsAt ? new Date(trialEndsAt).getTime() <= Date.now() : false;
  return { plan, gated, trialEndsAt, tenantId: user?.tenantId ?? null };
}

async function count(table: string, apply?: (q: any) => any): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count: n } = await q;
  return n ?? 0;
}

function monthStartISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const LIMIT_COUNT: Record<NumericLimitKey, () => Promise<number>> = {
  "professionals.limit": () => count("barbers", (q) => q.is("deleted_at", null).eq("active", true)),
  "clients.limit": () => count("client_subscriptions", (q) => q.eq("status", "ACTIVE")),
  "admins.limit": () => count("memberships", (q) => q.eq("role", "UNIT_ADMIN")),
  "appointments.monthly": () =>
    count("appointments", (q) => q.gte("created_at", monthStartISO()).neq("status", "CANCELLED")),
};

export type PlanUsage = {
  plan: SaasPlanKey;
  planLabel: string;
  gated: boolean;
  trialEndsAt: string | null;
  limits: Record<NumericLimitKey, number>;
  usage: Record<NumericLimitKey, number>;
  features: Record<FeatureKey, boolean>;
};

/** Uso atual x limites do plano (para a seção "Meu plano" e avisos). */
export async function getPlanUsage(): Promise<PlanUsage> {
  const eff = await getEffectivePlan();
  const [professionals, clients, admins, appointments] = await Promise.all([
    LIMIT_COUNT["professionals.limit"](),
    LIMIT_COUNT["clients.limit"](),
    LIMIT_COUNT["admins.limit"](),
    LIMIT_COUNT["appointments.monthly"](),
  ]);
  return {
    plan: eff.plan,
    planLabel: planLabel(eff.plan),
    gated: eff.gated,
    trialEndsAt: eff.trialEndsAt,
    limits: PLANS[eff.plan].limits,
    usage: {
      "professionals.limit": professionals,
      "clients.limit": clients,
      "admins.limit": admins,
      "appointments.monthly": appointments,
    },
    features: PLANS[eff.plan].features,
  };
}

export type Block = { allowed: true } | { allowed: false; needPlan: SaasPlanKey | null; message: string };

/** Checa um recurso (feature). Durante o teste, sempre liberado. */
export async function checkFeature(feature: FeatureKey): Promise<Block> {
  const eff = await getEffectivePlan();
  if (!eff.gated || hasEntitlement(eff.plan, feature)) return { allowed: true };
  const needPlan = minPlanForFeature(feature);
  return {
    allowed: false,
    needPlan,
    message: `Recurso disponível a partir do plano ${needPlan ? planLabel(needPlan) : "superior"}.`,
  };
}

/** Checa um limite numérico (bloqueia ao atingir o teto). Durante o teste, sempre liberado. */
export async function checkLimit(key: NumericLimitKey): Promise<Block> {
  const eff = await getEffectivePlan();
  if (!eff.gated || isUnlimited(eff.plan, key)) return { allowed: true };
  const max = getLimit(eff.plan, key);
  const used = await LIMIT_COUNT[key]();
  if (used < max) return { allowed: true };
  return {
    allowed: false,
    needPlan: minPlanForLimit(key, used + 1),
    message: `Você atingiu o limite do plano (${max}). Faça upgrade para ampliar.`,
  };
}

/** Checa se cabe um NOVO mensalista — não bloqueia troca de plano de quem já é ativo. */
export async function guardNewSubscriber(clientId: string): Promise<Block> {
  const supabase = await createSupabaseServerClient();
  const { count: already } = await supabase
    .from("client_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "ACTIVE");
  if ((already ?? 0) > 0) return { allowed: true }; // já conta como mensalista → é troca
  return checkLimit("clients.limit");
}

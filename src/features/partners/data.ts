import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { getRequestOrigin } from "@/lib/http";
import { PLANS, normalizeSaasPlan, planLabel } from "@/lib/entitlements";

export type PartnerType = "EMBAIXADORA" | "DIVULGADORA" | "DISTRIBUIDOR";
export type CommissionKind = "PCT" | "FIXED" | "NONE";

export type Partner = {
  id: string;
  name: string;
  type: PartnerType;
  isBarbershop: boolean;
  tenantId: string | null;
  refCode: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  instagram: string | null;
  commissionKind: CommissionKind;
  commissionValue: number;
  notes: string | null;
  active: boolean;
  createdAt: string;
};

export type PartnerRow = Partner & { referred: number; tenantName: string | null };

export type ReferredTenant = { id: string; name: string; plan: string; planLabel: string; status: string; createdAt: string };

export type PartnerDetail = Partner & {
  tenantName: string | null;
  affiliateLink: string;
  referredTenants: ReferredTenant[];
  referredCount: number;
  activeCount: number;
  estimatedCommission: number;
  commissionPeriod: "mês" | "total" | null;
};

const num = (v: unknown) => Number(v ?? 0);

function mapPartner(r: Record<string, unknown>): Partner {
  return {
    id: r.id as string,
    name: r.name as string,
    type: (r.type as PartnerType) ?? "DIVULGADORA",
    isBarbershop: r.is_barbershop === true,
    tenantId: (r.tenant_id as string) ?? null,
    refCode: r.ref_code as string,
    contactName: (r.contact_name as string) ?? null,
    contactPhone: (r.contact_phone as string) ?? null,
    contactEmail: (r.contact_email as string) ?? null,
    instagram: (r.instagram as string) ?? null,
    commissionKind: (r.commission_kind as CommissionKind) ?? "NONE",
    commissionValue: num(r.commission_value),
    notes: (r.notes as string) ?? null,
    active: r.active !== false,
    createdAt: r.created_at as string,
  };
}

/** Barbearias (tenants) mínimas, para mapear nomes e o select de vínculo. */
export async function listTenantsMini(): Promise<{ id: string; name: string }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("tenants").select("id, name").order("name");
  return ((data ?? []) as Record<string, unknown>[]).map((t) => ({ id: t.id as string, name: t.name as string }));
}

/** Lista de parceiros + nº de barbearias indicadas. Degrada para [] se a migração não foi aplicada. */
export async function getPartners(): Promise<PartnerRow[]> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return [];
  const admin = createSupabaseAdminClient();

  const pRes = await admin.from("partners").select("*").order("created_at", { ascending: false });
  if (pRes.error) return []; // tabela ainda não existe
  const partners = ((pRes.data ?? []) as Record<string, unknown>[]).map(mapPartner);

  // Contagem de indicados por parceiro + nomes dos tenants vinculados.
  const tRes = await admin.from("tenants").select("id, name, referred_by_partner_id");
  const tenants = tRes.error ? [] : ((tRes.data ?? []) as Record<string, unknown>[]);
  const nameById = new Map(tenants.map((t) => [t.id as string, t.name as string]));
  const countByPartner = new Map<string, number>();
  for (const t of tenants) {
    const pid = t.referred_by_partner_id as string | null;
    if (pid) countByPartner.set(pid, (countByPartner.get(pid) ?? 0) + 1);
  }

  return partners.map((p) => ({
    ...p,
    referred: countByPartner.get(p.id) ?? 0,
    tenantName: p.tenantId ? nameById.get(p.tenantId) ?? null : null,
  }));
}

/** Parceiros ativos para o dropdown do onboarding. */
export async function listPartnersForSelect(): Promise<{ id: string; name: string; refCode: string }[]> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return [];
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("partners").select("id, name, ref_code").eq("active", true).order("name");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({ id: p.id as string, name: p.name as string, refCode: p.ref_code as string }));
}

function estimateCommission(p: Partner, referred: ReferredTenant[]) {
  if (p.commissionKind === "PCT") {
    const total = referred
      .filter((t) => t.status === "ACTIVE")
      .reduce((a, t) => a + PLANS[normalizeSaasPlan(t.plan)].priceBRL * (p.commissionValue / 100), 0);
    return { estimatedCommission: total, commissionPeriod: "mês" as const };
  }
  if (p.commissionKind === "FIXED") {
    return { estimatedCommission: p.commissionValue * referred.length, commissionPeriod: "total" as const };
  }
  return { estimatedCommission: 0, commissionPeriod: null };
}

/** Detalhe de um parceiro + barbearias indicadas + comissão estimada. */
export async function getPartnerDetail(id: string): Promise<PartnerDetail | null> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return null;
  const admin = createSupabaseAdminClient();

  const { data: pr, error } = await admin.from("partners").select("*").eq("id", id).maybeSingle();
  if (error || !pr) return null;
  const partner = mapPartner(pr as Record<string, unknown>);

  const tRes = await admin
    .from("tenants")
    .select("id, name, saas_plan, status, created_at")
    .eq("referred_by_partner_id", id)
    .order("created_at", { ascending: false });
  const referredTenants: ReferredTenant[] = tRes.error
    ? []
    : ((tRes.data ?? []) as Record<string, unknown>[]).map((t) => {
        const plan = normalizeSaasPlan(t.saas_plan as string);
        return {
          id: t.id as string,
          name: t.name as string,
          plan,
          planLabel: planLabel(plan),
          status: (t.status as string) ?? "ACTIVE",
          createdAt: t.created_at as string,
        };
      });

  let tenantName: string | null = null;
  if (partner.tenantId) {
    const { data: tn } = await admin.from("tenants").select("name").eq("id", partner.tenantId).maybeSingle();
    tenantName = (tn?.name as string) ?? null;
  }

  const { estimatedCommission, commissionPeriod } = estimateCommission(partner, referredTenants);
  const origin = await getRequestOrigin();

  return {
    ...partner,
    tenantName,
    affiliateLink: `${origin}/?ref=${partner.refCode}`,
    referredTenants,
    referredCount: referredTenants.length,
    activeCount: referredTenants.filter((t) => t.status === "ACTIVE").length,
    estimatedCommission,
    commissionPeriod,
  };
}

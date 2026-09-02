import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { isDistributorPlan, distributorPlanInfo } from "@/lib/entitlements";

export type DistributorRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  planLabel: string;
  createdAt: string;
};

/** Lista de distribuidores (tenants kind=DISTRIBUTOR) — visão do Master. */
export async function getDistributors(): Promise<DistributorRow[]> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, subdomain, saas_plan, status, created_at")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[])
    .filter((t) => isDistributorPlan(t.saas_plan as string))
    .map((t) => ({
      id: t.id as string,
      name: t.name as string,
      subdomain: t.subdomain as string,
      status: (t.status as string) ?? "ACTIVE",
      planLabel: distributorPlanInfo(t.saas_plan as string).label,
      createdAt: t.created_at as string,
    }));
}

export type DistributorInfo = { id: string; name: string; subdomain: string; status: string; phone: string | null; createdAt: string };

/** Detalhe básico de um distribuidor (Master). */
export async function getDistributorForMaster(id: string): Promise<DistributorInfo | null> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return null;
  const admin = createSupabaseAdminClient();
  const { data: t } = await admin.from("tenants").select("id, name, subdomain, status, created_at, saas_plan").eq("id", id).maybeSingle();
  if (!t || !isDistributorPlan(t.saas_plan as string)) return null;
  const { data: s } = await admin.from("tenant_settings").select("phone").eq("tenant_id", id).maybeSingle();
  return {
    id: t.id as string,
    name: t.name as string,
    subdomain: t.subdomain as string,
    status: (t.status as string) ?? "ACTIVE",
    phone: (s?.phone as string) ?? null,
    createdAt: t.created_at as string,
  };
}

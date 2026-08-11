import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";

export type UpgradeRequest = {
  id: string;
  tenant_id: string;
  current_plan: string | null;
  requested_plan: string | null;
  reason: string | null;
  status: "PENDING" | "DONE" | "REJECTED";
  created_at: string;
};

/** Solicitações de upgrade de uma barbearia (MASTER, service-role). */
export async function getUpgradeRequestsForTenant(tenantId: string): Promise<UpgradeRequest[]> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("plan_upgrade_requests")
    .select("id, tenant_id, current_plan, requested_plan, reason, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as UpgradeRequest[] | null) ?? [];
}

/** Todas as solicitações PENDENTES (MASTER) — para uma visão geral. */
export async function getPendingUpgradeRequests(): Promise<UpgradeRequest[]> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("plan_upgrade_requests")
    .select("id, tenant_id, current_plan, requested_plan, reason, status, created_at")
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as UpgradeRequest[] | null) ?? [];
}

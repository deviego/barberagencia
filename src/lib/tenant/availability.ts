import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Barbearia suspensa pelo MASTER (tenants.status = SUSPENDED)? Usa o service-role
 * para não depender do RLS. Em caso de erro, não bloqueia (fail-open).
 */
export async function isTenantSuspended(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("tenants").select("status").eq("id", tenantId).maybeSingle();
    return (data?.status as string | undefined) === "SUSPENDED";
  } catch {
    return false;
  }
}

/**
 * A equipe (UNIT_ADMIN/NETWORK_ADMIN) deste usuário pertence a uma barbearia suspensa?
 * MASTER nunca é bloqueado; CLIENT não é afetado (o app do cliente segue no ar).
 */
export async function isStaffOfSuspendedTenant(userId: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("memberships").select("role, tenant_id").eq("user_id", userId);
    const rows = (data ?? []) as { role: string; tenant_id: string }[];
    if (rows.some((m) => m.role === "MASTER")) return false;
    const staff = rows.filter((m) => m.role === "UNIT_ADMIN" || m.role === "NETWORK_ADMIN");
    for (const m of staff) if (await isTenantSuspended(m.tenant_id)) return true;
    return false;
  } catch {
    return false;
  }
}

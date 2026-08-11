import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { CONTRACT_COLS, type TenantContract } from "./view";

export type { TenantContract } from "./view";

/** Contrato da barbearia atual (admin/MASTER atuando) — sob RLS. */
export async function getTenantContract(): Promise<TenantContract | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tenant_contracts").select(CONTRACT_COLS).maybeSingle();
  return (data as TenantContract | null) ?? null;
}

/** Contrato de uma barbearia específica — somente MASTER (service-role). */
export async function getTenantContractById(tenantId: string): Promise<TenantContract | null> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("tenant_contracts").select(CONTRACT_COLS).eq("tenant_id", tenantId).maybeSingle();
  return (data as TenantContract | null) ?? null;
}

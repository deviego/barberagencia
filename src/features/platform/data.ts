import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Lista todas as barbearias (tenants) com contagens — visão do Master (service-role). */
export async function getTenants() {
  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, subdomain, saas_plan, status, created_at")
    .order("created_at", { ascending: true });

  const out = [];
  for (const t of tenants ?? []) {
    const [{ count: clients }, { count: barbers }] = await Promise.all([
      admin.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      admin.from("barbers").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).eq("active", true),
    ]);
    out.push({
      id: t.id as string,
      name: t.name as string,
      subdomain: t.subdomain as string,
      saasPlan: (t.saas_plan as string) ?? "advance",
      status: (t.status as string) ?? "ACTIVE",
      clients: clients ?? 0,
      barbers: barbers ?? 0,
    });
  }
  return out;
}

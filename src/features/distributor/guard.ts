import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getTenantContract } from "@/features/contract/data";
import { isUnitAdmin } from "@/lib/rbac";

export type DistributorAccess =
  | { ok: true; tenantId: string }
  | { ok: false; reason: "UNAUTHENTICATED" | "NOT_DISTRIBUTOR" | "CONTRACT_PENDING" | "SUSPENDED" };

const DENIED_MESSAGE: Record<Exclude<DistributorAccess, { ok: true }>["reason"], string> = {
  UNAUTHENTICATED: "Sessão expirada. Entre de novo.",
  NOT_DISTRIBUTOR: "Acesso negado.",
  CONTRACT_PENDING: "Assine o contrato para continuar.",
  SUSPENDED: "Sua conta está suspensa. Fale com a Barber Agência pelo WhatsApp.",
};

/**
 * Acesso ao painel do distribuidor, sempre resolvido no servidor:
 * admin (UNIT_ADMIN ou acima) + tenant da sessão do tipo DISTRIBUTOR
 * + contrato assinado + conta não suspensa.
 * Layout e páginas chamam isto; actions usam requireActiveDistributor().
 */
export const getDistributorAccess = cache(async (): Promise<DistributorAccess> => {
  const user = await getSessionUser();
  if (!user?.tenantId || !user.role) return { ok: false, reason: "UNAUTHENTICATED" };
  if (!isUnitAdmin(user.role)) return { ok: false, reason: "NOT_DISTRIBUTOR" };

  const tenant = await getCurrentTenant();
  if (tenant.id !== user.tenantId || tenant.kind !== "DISTRIBUTOR") return { ok: false, reason: "NOT_DISTRIBUTOR" };

  // Suspensão primeiro: conta suspensa não vê nem o contrato.
  const supabase = await createSupabaseServerClient();
  const { data: t } = await supabase.from("tenants").select("status").eq("id", tenant.id).maybeSingle();
  if ((t?.status as string | undefined) === "SUSPENDED") return { ok: false, reason: "SUSPENDED" };

  const contract = await getTenantContract();
  if (contract?.status !== "SIGNED") return { ok: false, reason: "CONTRACT_PENDING" };

  return { ok: true, tenantId: tenant.id };
});

/** Para server actions do /distributor (exceto assinar o contrato). Mensagem curta, sem detalhe interno. */
export async function requireActiveDistributor(): Promise<{ ok: true; tenantId: string } | { ok: false; error: string }> {
  const access = await getDistributorAccess();
  if (access.ok) return access;
  return { ok: false, error: DENIED_MESSAGE[access.reason] };
}

/**
 * [Barbearia] O distribuidor está recebendo pedidos? CLOSED se não existir, não for
 * distribuidor ou estiver suspenso. Só devolve OPEN/CLOSED (nenhum outro dado do tenant).
 * Service role: a barbearia não lê `tenants` de outro tenant sob RLS.
 */
export async function getSupplierAvailability(distributorId: string): Promise<"OPEN" | "CLOSED"> {
  const user = await getSessionUser();
  if (!user?.tenantId) return "CLOSED";
  const admin = createSupabaseAdminClient();
  let res = await admin.from("tenants").select("status, kind").eq("id", distributorId).maybeSingle();
  if (res.error) res = await admin.from("tenants").select("status").eq("id", distributorId).maybeSingle();
  const t = res.data as { status?: string; kind?: string } | null;
  if (!t || t.status === "SUSPENDED") return "CLOSED";
  if (t.kind !== undefined && t.kind !== "DISTRIBUTOR") return "CLOSED";
  return "OPEN";
}

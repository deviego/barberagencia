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
  | { ok: false; reason: "UNAUTHENTICATED" | "NOT_DISTRIBUTOR" | "CONTRACT_PENDING" | "SUSPENDED" | "INACTIVE" };

const DENIED_MESSAGE: Record<Exclude<DistributorAccess, { ok: true }>["reason"], string> = {
  UNAUTHENTICATED: "Sessão expirada. Entre de novo.",
  NOT_DISTRIBUTOR: "Acesso negado.",
  CONTRACT_PENDING: "Assine o contrato para continuar.",
  SUSPENDED: "Sua conta está suspensa. Fale com a Barber Agência pelo WhatsApp.",
  INACTIVE: "Sua conta ainda não está ativa. Fale com a gente pelo WhatsApp.",
};

/** Só o status ACTIVE libera; valor desconhecido, novo ou ausente bloqueia. */
const ALLOWED_STATUSES: ReadonlySet<string> = new Set(["ACTIVE"]);
function isActiveStatus(status: unknown): boolean {
  return typeof status === "string" && ALLOWED_STATUSES.has(status);
}

/**
 * Acesso ao painel do distribuidor, sempre resolvido no servidor:
 * admin (UNIT_ADMIN ou acima) + tenant da sessão do tipo DISTRIBUTOR
 * + conta ativa + contrato assinado.
 * Ordem das telas (decisão do PO na #71): suspensa → contrato pendente (quem está entrando consegue assinar)
 * → qualquer outro status diferente de ACTIVE ("ainda não está ativa").
 * Layout e páginas chamam isto; actions usam requireActiveDistributor().
 */
export const getDistributorAccess = cache(async (): Promise<DistributorAccess> => {
  const user = await getSessionUser();
  if (!user?.tenantId || !user.role) return { ok: false, reason: "UNAUTHENTICATED" };
  if (!isUnitAdmin(user.role)) return { ok: false, reason: "NOT_DISTRIBUTOR" };

  const tenant = await getCurrentTenant();
  if (tenant.id !== user.tenantId || tenant.kind !== "DISTRIBUTOR") return { ok: false, reason: "NOT_DISTRIBUTOR" };

  // Falha fechado: só ACTIVE libera. Erro na leitura bloqueia como "ainda não está ativa".
  const supabase = await createSupabaseServerClient();
  const { data: t, error } = await supabase.from("tenants").select("status").eq("id", tenant.id).maybeSingle();
  if (error) return { ok: false, reason: "INACTIVE" };
  if (t?.status === "SUSPENDED") return { ok: false, reason: "SUSPENDED" };

  const contract = await getTenantContract();
  if (contract?.status !== "SIGNED") return { ok: false, reason: "CONTRACT_PENDING" };

  if (!isActiveStatus(t?.status)) return { ok: false, reason: "INACTIVE" };

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
 * distribuidor, não estiver com a conta ativa ou a consulta falhar. Só devolve OPEN/CLOSED (nenhum outro dado do tenant).
 * Service role: a barbearia não lê `tenants` de outro tenant sob RLS.
 */
export async function getSupplierAvailability(distributorId: string): Promise<"OPEN" | "CLOSED"> {
  const user = await getSessionUser();
  if (!user?.tenantId) return "CLOSED";
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("tenants").select("status, kind").eq("id", distributorId).maybeSingle();
  if (error || !data) return "CLOSED";
  const t = data as { status?: string | null; kind?: string | null };
  return t.kind === "DISTRIBUTOR" && isActiveStatus(t.status) ? "OPEN" : "CLOSED";
}

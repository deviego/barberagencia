import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { isUnitAdmin } from "@/lib/rbac";
import type { TenantKind } from "@/lib/tenant/types";

export type OrdersGuard = { ok: true; tenantId: string; kind: TenantKind } | { ok: false; error: string };

const DENIED: OrdersGuard = { ok: false, error: "Acesso negado." };

/** Admin (UNIT_ADMIN ou acima) do tenant da sessão, com o tipo resolvido no servidor. */
async function sessionAdmin(): Promise<OrdersGuard> {
  const user = await getSessionUser();
  if (!user?.tenantId || !user.role || !isUnitAdmin(user.role)) return DENIED;
  const tenant = await getCurrentTenant();
  if (tenant.id !== user.tenantId) return DENIED;
  return { ok: true, tenantId: tenant.id, kind: tenant.kind };
}

/** Admin de um tenant DISTRIBUTOR (lado que recebe pedidos). */
export async function requireDistributorAdmin(): Promise<OrdersGuard> {
  const g = await sessionAdmin();
  return g.ok && g.kind === "DISTRIBUTOR" ? g : DENIED;
}

/** Admin de um tenant BARBERSHOP (lado que compra). */
export async function requireBarbershopAdmin(): Promise<OrdersGuard> {
  const g = await sessionAdmin();
  return g.ok && g.kind === "BARBERSHOP" ? g : DENIED;
}

/** Admin de qualquer um dos dois lados (ex.: mudar status: distribuidor avança, barbearia cancela). */
export async function requireOrderParticipantAdmin(): Promise<OrdersGuard> {
  return sessionAdmin();
}

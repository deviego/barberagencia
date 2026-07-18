import { getCurrentTenant } from "@/lib/tenant/resolve";
import { hasEntitlement, type FeatureKey } from "@/lib/entitlements";

/**
 * <Gate> — esconde UI de recursos que o plano SaaS do tenant não habilita.
 * APENAS visual/UX. A checagem de verdade é `assertEntitlement` no servidor.
 */
export async function Gate({
  feature,
  children,
  fallback = null,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();
  return hasEntitlement(tenant.saasPlan, feature) ? <>{children}</> : <>{fallback}</>;
}

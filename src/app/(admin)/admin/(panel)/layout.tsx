import { redirect } from "next/navigation";
import { AdminShell } from "@/components/nav/admin-shell";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { getPendingCount } from "@/features/admin/data";
import { getTenants } from "@/features/platform/data";
import { getActingTenantId } from "@/lib/auth/acting";
import { isMaster, isUnitAdmin } from "@/lib/rbac";
import { getTenantContract } from "@/features/contract/data";
import { buildContractView } from "@/features/contract/view";
import { ContractModal } from "@/features/contract/components/contract-modal";
import { SystemUnavailableModal } from "@/features/auth/components/system-unavailable-modal";
import { isTenantSuspended } from "@/lib/tenant/availability";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!user.role || !isUnitAdmin(user.role)) redirect("/admin/login");

  const master = isMaster(user.role);
  const [tenant, pendingCount, allTenants, actingId, contract] = await Promise.all([
    getCurrentTenant(),
    getPendingCount(),
    master ? getTenants() : Promise.resolve([]),
    master ? getActingTenantId() : Promise.resolve(null),
    getTenantContract(),
  ]);

  // Distribuidor logado não usa o painel de barbearia — vai para o painel próprio.
  if (tenant.kind === "DISTRIBUTOR") redirect("/distributor");

  // Barbearia suspensa pelo MASTER: a equipe vê só "Sistema indisponível" (MASTER segue com acesso).
  if (!master && (await isTenantSuspended(tenant.id))) return <SystemUnavailableModal />;

  const contractView = buildContractView(contract);
  // Modal do contrato enquanto não assinado.
  const showModal = !!contractView && contract!.status !== "SIGNED";

  return (
    <>
      <AdminShell
        logoText={tenant.branding.logoText}
        logoUrl={tenant.branding.logoUrl}
        name={tenant.name}
        plan={tenant.saasPlan}
        userName={user.name}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        pendingCount={pendingCount}
        isMaster={master}
        tenants={master ? allTenants.map((t) => ({ id: t.id, name: t.name })) : undefined}
        acting={!!actingId}
      >
        {children}
      </AdminShell>
      {showModal && contractView && <ContractModal view={contractView} />}
    </>
  );
}

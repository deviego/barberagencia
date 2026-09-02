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

  const contractView = buildContractView(contract);
  // Banner só durante o teste ativo e não assinado.
  const trialActive =
    !!contract && contract.trial_enabled && contract.status !== "SIGNED" && new Date(contract.trial_ends_at).getTime() > Date.now();
  // Modal após o teste (ou sem teste), enquanto não assinado.
  const showModal =
    !!contractView && contract!.status !== "SIGNED" && new Date(contract!.trial_ends_at).getTime() <= Date.now();

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
        trialEndsAt={trialActive ? contract!.trial_ends_at : null}
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

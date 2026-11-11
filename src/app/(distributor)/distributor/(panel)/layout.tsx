import { redirect } from "next/navigation";
import { DistributorSidebar } from "@/components/nav/distributor-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getDistributorAccess } from "@/features/distributor/guard";
import { getTenantContract } from "@/features/contract/data";
import { buildContractView, contractToData } from "@/features/contract/view";
import { DistributorContractGate, DistributorSuspended } from "@/features/distributor/components/distributor-blocked";

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const access = await getDistributorAccess();
  if (!access.ok) {
    if (access.reason === "UNAUTHENTICATED") redirect("/distributor/login");
    // Só distribuidores usam este painel; barbearia vai para o /admin.
    if (access.reason === "NOT_DISTRIBUTOR") redirect("/admin");
    // Suspenso: nenhuma informação do painel.
    if (access.reason === "SUSPENDED") return <DistributorSuspended />;
    // Contrato pendente: só a tela do contrato (o resto do painel fica fechado até assinar).
    const [tenant, contract] = await Promise.all([getCurrentTenant(), getTenantContract()]);
    return (
      <DistributorContractGate
        tenantName={tenant.name}
        view={buildContractView(contract)}
        initial={{ ...contractToData(contract), tradeName: contract?.trade_name ?? tenant.name }}
      />
    );
  }

  const tenant = await getCurrentTenant();

  return (
    <div className="flex min-h-screen">
      <DistributorSidebar name={tenant.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-semibold text-text">{tenant.name}</span>
            <Badge variant="accent">Distribuidor</Badge>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

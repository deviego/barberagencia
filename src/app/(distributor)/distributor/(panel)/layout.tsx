import { redirect } from "next/navigation";
import { DistributorSidebar } from "@/components/nav/distributor-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { getSessionUser } from "@/lib/auth/session";
import { isUnitAdmin } from "@/lib/rbac";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || !user.role || !isUnitAdmin(user.role)) redirect("/distributor/login");

  const tenant = await getCurrentTenant();
  // Só distribuidores usam este painel; barbearia vai para o /admin.
  if (tenant.kind !== "DISTRIBUTOR") redirect("/admin");

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

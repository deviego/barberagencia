import { AdminSidebar } from "@/components/nav/admin-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { PLANS } from "@/lib/entitlements";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        logoText={tenant.branding.logoText}
        name={tenant.name}
        plan={tenant.saasPlan}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-body font-semibold text-text">{tenant.name}</span>
            <Badge variant="accent">Plano {PLANS[tenant.saasPlan].label}</Badge>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

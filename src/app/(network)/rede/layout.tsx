import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { isNetworkAdmin } from "@/lib/rbac";

export default async function NetworkLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.role || !isNetworkAdmin(user.role)) redirect("/");

  const tenant = await getCurrentTenant();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-body font-semibold text-text">{tenant.name}</span>
          <Badge variant="accent">Rede</Badge>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}

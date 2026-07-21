import { redirect } from "next/navigation";
import { AdminShell } from "@/components/nav/admin-shell";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { isUnitAdmin } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.role || !isUnitAdmin(user.role)) redirect("/");

  const tenant = await getCurrentTenant();
  return (
    <AdminShell
      logoText={tenant.branding.logoText}
      logoUrl={tenant.branding.logoUrl}
      name={tenant.name}
      plan={tenant.saasPlan}
    >
      {children}
    </AdminShell>
  );
}

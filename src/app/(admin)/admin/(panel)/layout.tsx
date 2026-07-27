import { redirect } from "next/navigation";
import { AdminShell } from "@/components/nav/admin-shell";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { getPendingCount } from "@/features/admin/data";
import { isUnitAdmin } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!user.role || !isUnitAdmin(user.role)) redirect("/admin/login");

  const [tenant, pendingCount] = await Promise.all([getCurrentTenant(), getPendingCount()]);
  return (
    <AdminShell
      logoText={tenant.branding.logoText}
      logoUrl={tenant.branding.logoUrl}
      name={tenant.name}
      plan={tenant.saasPlan}
      userName={user.name}
      userEmail={user.email}
      avatarUrl={user.avatarUrl}
      pendingCount={pendingCount}
      trialEndsAt={tenant.subdomain === "oliveira01" ? "2026-08-03T23:59:59-03:00" : null}
    >
      {children}
    </AdminShell>
  );
}

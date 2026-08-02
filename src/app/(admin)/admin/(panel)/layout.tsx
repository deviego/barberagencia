import { redirect } from "next/navigation";
import { AdminShell } from "@/components/nav/admin-shell";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { getPendingCount } from "@/features/admin/data";
import { getTenants } from "@/features/platform/data";
import { getActingTenantId } from "@/lib/auth/acting";
import { isMaster, isUnitAdmin } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!user.role || !isUnitAdmin(user.role)) redirect("/admin/login");

  const master = isMaster(user.role);
  const [tenant, pendingCount, allTenants, actingId] = await Promise.all([
    getCurrentTenant(),
    getPendingCount(),
    master ? getTenants() : Promise.resolve([]),
    master ? getActingTenantId() : Promise.resolve(null),
  ]);

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
      isMaster={master}
      tenants={master ? allTenants.map((t) => ({ id: t.id, name: t.name })) : undefined}
      acting={!!actingId}
    >
      {children}
    </AdminShell>
  );
}

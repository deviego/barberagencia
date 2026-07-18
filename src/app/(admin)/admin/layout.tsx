import { AdminShell } from "@/components/nav/admin-shell";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  return (
    <AdminShell logoText={tenant.branding.logoText} name={tenant.name} plan={tenant.saasPlan}>
      {children}
    </AdminShell>
  );
}

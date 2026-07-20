import { redirect } from "next/navigation";
import { ClientHeader } from "@/components/nav/client-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FabWhatsApp } from "@/components/nav/fab-whatsapp";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "MASTER") redirect("/master");
  if (user.role === "NETWORK_ADMIN") redirect("/rede");
  if (user.role === "UNIT_ADMIN") redirect("/admin");

  const tenant = await getCurrentTenant();
  return (
    <div className="min-h-screen">
      <ClientHeader logoText={tenant.branding.logoText} name={tenant.name} />
      <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-6 md:pb-10">{children}</main>
      <BottomNav />
      <FabWhatsApp />
    </div>
  );
}

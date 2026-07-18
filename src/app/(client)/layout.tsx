import { ClientHeader } from "@/components/nav/client-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FabWhatsApp } from "@/components/nav/fab-whatsapp";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
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

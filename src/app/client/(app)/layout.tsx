import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Eye } from "lucide-react";
import { ClientHeader } from "@/components/nav/client-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { getActivePlanBalance } from "@/features/client/data";
import { exitClientPreview } from "@/features/auth/actions";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/client/login");

  const preview = (await cookies()).get(VIEW_AS_CLIENT_COOKIE)?.value === "1";
  const isAdmin =
    user.role === "MASTER" || user.role === "NETWORK_ADMIN" || user.role === "UNIT_ADMIN";
  // Admin só entra no app do cliente no modo "ver como cliente"; senão vai pro painel do papel.
  if (isAdmin && !preview) {
    redirect(user.role === "MASTER" ? "/master" : user.role === "NETWORK_ADMIN" ? "/rede" : "/admin");
  }

  const [tenant, balance] = await Promise.all([getCurrentTenant(), getActivePlanBalance()]);
  const hasPlan = balance !== null; // sem assinatura ativa → oculta "Meu plano"
  // Com plano e saldo > 0, "Agendar" vai direto ao horário; senão, escolhe serviço.
  const agendarHref = (balance ?? 0) > 0 ? "/client/agendar" : "/client/servicos";
  return (
    <div className="min-h-screen">
      {isAdmin && preview && (
        <div className="flex items-center justify-between gap-2 bg-accent px-4 py-2 text-caption text-text-inverse">
          <span className="flex items-center gap-1.5">
            <Eye size={14} /> Visualizando como cliente
          </span>
          <form action={exitClientPreview}>
            <button className="rounded-md bg-black/20 px-2.5 py-1 font-semibold transition-colors hover:bg-black/30">
              Voltar ao painel
            </button>
          </form>
        </div>
      )}
      <ClientHeader
        logoText={tenant.branding.logoText}
        logoUrl={tenant.branding.logoUrl}
        name={tenant.name}
        userName={user.name}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        agendarHref={agendarHref}
        hasPlan={hasPlan}
      />
      <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-6 md:pb-10">{children}</main>
      <BottomNav agendarHref={agendarHref} hasPlan={hasPlan} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { LogoutButton } from "@/components/nav/logout-button";
import { ConfirmWhatsappFlow } from "@/features/auth/components/confirm-whatsapp-flow";
import { confirmWhatsapp, proveAccountAndLink } from "@/features/auth/google-actions";
import { getPendingAccount } from "@/features/auth/google-data";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Confirme seu WhatsApp", robots: { index: false } };

/**
 * Conta que entrou com Google e ainda não é cliente de nenhuma barbearia (ADR 0005, itens 3 a 5).
 * O layout da área do cliente manda para cá; daqui só se sai confirmando o WhatsApp ou saindo.
 */
export default async function ConfirmarWhatsappPage() {
  const user = await getSessionUser();
  if (!user) redirect("/client/login");

  const pending = await getPendingAccount();
  if (pending.status === "ACTIVE") redirect("/client");

  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;

  if (pending.status === "PENDING_NO_SHOP") {
    return (
      <div className="mx-auto flex w-[400px] max-w-full flex-col items-center gap-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent">
          <MapPin size={26} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-h2 uppercase leading-none text-text">Abra o link da barbearia</h1>
          <p className="mt-2 text-body text-text-2">
            Não achamos de qual barbearia você veio. Abra o link que a sua barbearia mandou e entre com o
            Google por lá.
          </p>
        </div>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        {user.avatarUrl ? (
          // Foto do Google (domínio externo): <img> simples, sem otimização do Next.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            width={72}
            height={72}
            referrerPolicy="no-referrer"
            className="h-[72px] w-[72px] rounded-full border-2 border-accent object-cover"
          />
        ) : (
          <LogoMark
            text={pending.shop.logoText}
            src={pending.shop.logoUrl}
            size={72}
            className="rounded-lg shadow-lg"
          />
        )}
      </div>
      <ConfirmWhatsappFlow
        shopName={pending.shop.name}
        firstName={firstName}
        confirmWhatsapp={confirmWhatsapp}
        proveAccountAndLink={proveAccountAndLink}
      />
      <div className="flex justify-center">
        <LogoutButton />
      </div>
    </div>
  );
}

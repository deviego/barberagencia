import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/nav/logout-button";
import { PerfilForm } from "@/features/client/components/perfil-form";
import { ChildrenSection } from "@/features/client/components/children-section";
import type { Child } from "@/features/client/components/child-modal";
import { ContactEmailCard } from "@/features/auth/components/contact-email-card";
import { contactLinkResult } from "@/features/auth/contact-screen-copy";
import { getContactEmailState } from "@/features/auth/contact-data";
import { GoogleConnectCard } from "@/features/auth/components/google-connect-card";
import { getMyLoginMethods } from "@/features/auth/google-data";
import { callbackErrorMessage } from "@/features/auth/google-errors";
import { isGoogleLoginEnabled } from "@/lib/auth/google-flag";
import { getProfile, getMyChildren } from "@/features/client/data";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; contato?: string | string[] }>;
}) {
  const google = isGoogleLoginEnabled();
  const [data, children, contact, methods, params] = await Promise.all([
    getProfile(),
    getMyChildren(),
    getContactEmailState(),
    google ? getMyLoginMethods() : Promise.resolve(null),
    searchParams,
  ]);
  if (!data) redirect("/client/login");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-bold text-text">Meu perfil</h1>
        <LogoutButton />
      </div>

      <PerfilForm
        userId={data.userId}
        fullName={data.fullName}
        phone={data.phone}
        email={contact.email ?? ""}
        avatarUrl={data.avatarUrl}
      />

      <ContactEmailCard state={contact} linkResult={contactLinkResult(params.contato)} />

      {methods && (
        <GoogleConnectCard connected={methods.google} error={callbackErrorMessage(params.error)} />
      )}

      <ChildrenSection initial={children as Child[]} />
    </div>
  );
}

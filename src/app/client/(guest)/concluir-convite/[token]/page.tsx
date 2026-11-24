import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { CompleteInvite } from "@/features/auth/components/complete-invite";
import { CONTACT_SCREEN_COPY as COPY } from "@/features/auth/contact-screen-copy";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Concluir convite", robots: { index: false } };

/**
 * Concluir o convite de quem já criou a conta por ele, mas ficou sem vínculo (#177).
 * Fica dentro de /client (e fora do layout do app) para a sessão do cliente chegar ao servidor.
 */
export default async function ConcluirConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ auto?: string | string[] }>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect("/client/login");
  if (user.role) redirect("/client");

  // A marca vem do próprio convite (como em /convite/[token]); sem dado da ficha convidada.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("invite_info", { p_token: token });
  const info = (Array.isArray(data) ? data[0] : data) as
    | { valid: boolean; tenant_name: string | null; logo_text: string | null; logo_url: string | null }
    | undefined;
  const shopName = info?.tenant_name ?? "barbearia";

  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark text={info?.logo_text ?? "BB"} src={info?.logo_url ?? null} size={72} className="rounded-lg" />
        <h1 className="font-display text-h2 uppercase leading-none text-text">{info?.tenant_name ?? "Barbearia"}</h1>
      </div>
      <div className="rounded-lg border border-border bg-surface p-7 shadow-lg">
        {info?.valid ? (
          <CompleteInvite token={token} shopName={shopName} autoStart={sp.auto === "1"} />
        ) : (
          <p role="alert" className="text-center text-body text-text-2">
            {COPY.inviteInvalid}
          </p>
        )}
      </div>
    </div>
  );
}

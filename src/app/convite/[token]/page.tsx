import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { AcceptInviteForm } from "@/features/auth/components/accept-invite-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [tenant, supabase] = await Promise.all([getCurrentTenant(), createSupabaseServerClient()]);
  const { data } = await supabase.rpc("invite_status", { p_token: token });
  const info = (Array.isArray(data) ? data[0] : data) as
    | { valid: boolean; email: string | null; name: string | null }
    | undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-[400px] max-w-full">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark text={tenant.branding.logoText} src={tenant.branding.logoUrl} size={72} className="rounded-lg" />
          <h1 className="font-display text-h2 uppercase leading-none text-text">{tenant.name}</h1>
        </div>
        <div className="rounded-lg border border-border bg-surface p-7 shadow-lg">
          {info?.valid ? (
            <>
              <p className="mb-4 text-body text-text-2">
                Você foi convidado{info.name ? `, ${info.name.split(" ")[0]}` : ""}! Crie seu acesso para
                agendar seus cortes.
              </p>
              <AcceptInviteForm token={token} email={info.email ?? ""} name={info.name ?? ""} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-body text-text-2">Este convite é inválido ou expirou.</p>
              <Link href="/cadastro" className="text-body font-semibold text-accent hover:underline">
                Criar conta
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

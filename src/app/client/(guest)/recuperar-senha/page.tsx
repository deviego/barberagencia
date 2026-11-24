import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ForgotForm } from "@/features/auth/components/forgot-form";
import { CONTACT_SCREEN_COPY as COPY } from "@/features/auth/contact-screen-copy";

export default async function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  // Link vencido ou já usado volta com ?error=link (#177). Nunca mostramos texto vindo da URL.
  const linkInvalid = (await searchParams).error === "link";
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash">
          <KeyRound size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">Recuperar senha</h1>
        <p className="mt-2 text-body text-text-2">
          {COPY.resetSubtitle}
        </p>
      </div>
      {linkInvalid && (
        <p role="alert" className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-caption text-danger">
          {COPY.resetLinkInvalid}
        </p>
      )}
      <ForgotForm />
      <Link
        href="/client/login"
        className="text-center text-caption text-text-muted hover:text-accent"
      >
        ← Voltar ao login
      </Link>
    </div>
  );
}

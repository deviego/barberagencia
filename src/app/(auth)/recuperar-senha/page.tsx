import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ForgotForm } from "@/features/auth/components/forgot-form";

export default function RecuperarSenhaPage() {
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash">
          <KeyRound size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">Redefinir senha</h1>
        <p className="mt-2 text-body text-text-2">
          Informe seu e-mail e enviaremos o link de redefinição.
        </p>
      </div>
      <ForgotForm />
      <Link
        href="/login"
        className="text-center text-caption text-text-muted hover:text-accent"
      >
        ← Voltar ao login
      </Link>
    </div>
  );
}

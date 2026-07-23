import { KeyRound } from "lucide-react";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata = { title: "Definir nova senha" };

export default function RedefinirSenhaPage() {
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash">
          <KeyRound size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">Nova senha</h1>
        <p className="mt-2 text-body text-text-2">Crie uma nova senha para acessar sua conta.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}

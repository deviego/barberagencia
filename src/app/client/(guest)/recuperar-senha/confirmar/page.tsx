import { KeyRound } from "lucide-react";
import { ConfirmResetForm } from "@/features/auth/components/confirm-reset-form";

export const metadata = { title: "Recuperar senha" };

/** Link do WhatsApp cai aqui. Não consome o token no GET (pré-visualizações de link
 *  gastariam o token de uso único) — só ao clicar no botão. */
export default async function ConfirmarRecuperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash">
          <KeyRound size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">Recuperar senha</h1>
        <p className="mt-2 text-body text-text-2">Toque no botão para criar uma nova senha.</p>
      </div>
      <ConfirmResetForm tokenHash={token_hash ?? ""} />
    </div>
  );
}

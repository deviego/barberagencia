import { redirect } from "next/navigation";
import { CompleteInvite } from "@/features/auth/components/complete-invite";
import { hasPendingInvite } from "@/features/auth/pending-invite";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Concluir convite", robots: { index: false } };

/**
 * Concluir o convite pendente sem o link (#177): a conta da SESSÃO foi criada por um convite e o
 * servidor marcou que a ficha ainda não foi ligada (janela de 1 h). Sem marcador válido, volta ao
 * fluxo normal. Quem tem o link usa /client/concluir-convite/[token].
 */
export default async function ConcluirConvitePendentePage() {
  const user = await getSessionUser();
  if (!user) redirect("/client/login");
  if (user.role) redirect("/client");
  if (!(await hasPendingInvite(user.id))) redirect("/client/confirmar-whatsapp");

  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
      <div className="rounded-lg border border-border bg-surface p-7 shadow-lg">
        <CompleteInvite shopName="barbearia" autoStart />
      </div>
    </div>
  );
}

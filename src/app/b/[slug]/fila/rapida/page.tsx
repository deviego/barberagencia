import type { Metadata } from "next";
import { getQuickQueueEntry } from "@/features/quick-queue/data";
import { QuickQueueShell } from "@/features/quick-queue/components/quick-queue-shell";
import { QuickQueueNotice } from "@/features/quick-queue/components/quick-queue-notice";
import { PhoneStep } from "@/features/quick-queue/components/phone-step";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pegue sua senha",
  robots: { index: false, follow: false },
};

/**
 * Fila rápida do cliente (#95). Chega aqui pelo despachante /b/<slug>/fila quando a fila rápida
 * está ligada. Tudo é decidido no servidor a partir do endereço: a página não recebe
 * identificador nenhum do aparelho e só mostra a marca da barbearia e o estado.
 */
export default async function QuickQueuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getQuickQueueEntry(slug);

  // Fora de OPEN a tela é neutra: sem marca, sem formulário e sem dizer o motivo.
  if (entry.status !== "OPEN") {
    return (
      <QuickQueueShell>
        <QuickQueueNotice kind={entry.status} />
      </QuickQueueShell>
    );
  }

  // TODO(#97): CLIENT vai direto para a escolha do serviço. TODO(#98): HAS_TICKET cai em "Minha senha".
  return (
    <QuickQueueShell brand={entry.brand}>
      <PhoneStep />
    </QuickQueueShell>
  );
}

import type { Metadata } from "next";
import { getQuickQueueEntry } from "@/features/quick-queue/data";
import { QuickQueueShell } from "@/features/quick-queue/components/quick-queue-shell";
import { QuickQueueNotice } from "@/features/quick-queue/components/quick-queue-notice";
import { IdentifyFlow } from "@/features/quick-queue/components/identify-flow";

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

  // Cliente logado também passa pelo telefone nesta fase (um caminho só, decisão do CTO no #97).
  // Senha ativa neste aparelho: o IdentifyFlow consulta /status ao abrir e vai direto para "Minha senha".
  return (
    <QuickQueueShell brand={entry.brand}>
      <IdentifyFlow slug={slug} />
    </QuickQueueShell>
  );
}

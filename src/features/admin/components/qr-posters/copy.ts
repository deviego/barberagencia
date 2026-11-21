/**
 * Passos do cartaz A (Fila digital), copy aprovada no #127. Puro, sem canvas: coberto em
 * scripts/test-qr-posters-visibility.mjs.
 * O passo 2 depende de como o cliente entra na fila: PHONE (fila rápida ligada) pede só o
 * telefone; LOGIN (fila com conta) pede a conta. Na prática o cartaz A só aparece com a fila
 * rápida ligada (showQueuePoster), então sai com "Digite o seu telefone".
 */
export type QueueEntryMode = "LOGIN" | "PHONE";

export const QUEUE_POSTER_STEP2: Record<QueueEntryMode, string> = {
  PHONE: "Digite o seu telefone",
  LOGIN: "Entre na sua conta ou faça o cadastro",
};

export function queuePosterSteps(entry: QueueEntryMode): [string, string, string] {
  return [
    "Aponte a câmera do celular para o QR code",
    QUEUE_POSTER_STEP2[entry === "PHONE" ? "PHONE" : "LOGIN"],
    "Pegue a senha e acompanhe a fila na tela",
  ];
}

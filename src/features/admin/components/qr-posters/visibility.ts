/**
 * Quando o cartaz A (Fila digital, /b/<slug>/fila) aparece em Configurações (#127).
 * Só com as três condições verdadeiras: recurso "queue" no plano (ou em teste), fila ligada e a
 * fila rápida ligada nesta barbearia (tenants.quick_queue_enabled, schema-51). Qualquer outro
 * valor (false, coluna ausente, erro de leitura = null/undefined) esconde o cartaz A.
 * No modo só totem ele também some: lá o link do cliente não dá senha.
 * O cartaz B (Cadastro, /b/<slug>) não depende disto.
 */
export type QueuePosterGate = {
  planHasQueue: boolean | null | undefined;
  queueEnabled: boolean | null | undefined;
  quickQueueEnabled: boolean | null | undefined;
  queueMode?: "TOTEM" | "APP" | "BOTH" | null;
};

export function showQueuePoster(g: QueuePosterGate): boolean {
  return g.planHasQueue === true && g.queueEnabled === true && g.quickQueueEnabled === true && g.queueMode !== "TOTEM";
}

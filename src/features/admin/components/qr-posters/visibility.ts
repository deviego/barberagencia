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

/**
 * Aviso no lugar do cartaz A (#102): fila no plano e ligada, mas fila rápida desligada (estado
 * inicial). Mostra só o cartaz B e QUICK_QUEUE_ADMIN_MESSAGES.posterHint. Fora disso, nada muda.
 */
export function showQueuePosterHint(g: QueuePosterGate): boolean {
  return g.planHasQueue === true && g.queueEnabled === true && g.quickQueueEnabled !== true;
}

/**
 * A fila rápida desta barbearia está ligada? Falha fechado: sem estado, coluna ausente, valor que
 * não é true ou estado de OUTRA barbearia = desligada. Erro de leitura fica com quem chama (false).
 */
export function quickQueueOnFor(
  state: { id?: string | null; quickQueueEnabled?: boolean | null } | null | undefined,
  tenantId: string,
): boolean {
  return !!state && !!tenantId && state.id === tenantId && state.quickQueueEnabled === true;
}

/**
 * Alerta ao dono (#145, condição da Navalha): só com a fila rápida ligada e, hoje, o teto de
 * senhas atingido (tenantCapHit) ou o total de limites estourados >= minTotal. Sem resumo
 * (erro de leitura) = sem alerta. "CAP" escolhe o texto do teto; "HIGH", o do total alto.
 */
export function quickQueueLimitAlert(
  summary: { total?: number | null; tenantCapHit?: boolean | null } | null | undefined,
  quickQueueEnabled: boolean | null | undefined,
  minTotal: number,
): "CAP" | "HIGH" | null {
  if (quickQueueEnabled !== true || !summary) return null;
  if (summary.tenantCapHit === true) return "CAP";
  const total = typeof summary.total === "number" && Number.isFinite(summary.total) ? summary.total : 0;
  return total >= minTotal ? "HIGH" : null;
}

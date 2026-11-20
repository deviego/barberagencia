/** Regras de limite de tentativas (puras, testáveis sem banco). */
export type RateRule = {
  /** Máximo de tentativas aceitas dentro da janela. */
  limit: number;
  windowSeconds: number;
};

/** true = recusar. Recebe quantas tentativas JÁ foram aceitas na janela. */
export function isOverLimit(count: number, rule: Pick<RateRule, "limit">): boolean {
  return count >= rule.limit;
}

/** Chave de contagem por visitante + barbearia. O IP entra sempre como hash. */
export function ipTenantKey(ipHash: string, tenantId: string): string {
  return `${ipHash}:${tenantId}`;
}

/**
 * Limites em memória da rota de status (#148). Puro (sem servidor nem banco) para ser testado.
 * Vale por instância do servidor: é uma barreira barata contra volume, antes de ler o banco.
 * As chaves são só o endereço da barbearia e o resumo da credencial: nada de rede nem pessoal.
 */

/** Janela fixa por chave. hit() = true se ainda cabe; false se passou do teto. */
export function createWindowCounter(max: number, windowMs: number, maxKeys = 2_000) {
  const counts = new Map<string, { start: number; n: number }>();
  return {
    hit(key: string, now: number = Date.now()): boolean {
      let c = counts.get(key);
      if (!c || now - c.start >= windowMs) {
        if (!c && counts.size >= maxKeys) counts.clear(); // limite de memória
        c = { start: now, n: 0 };
        counts.set(key, c);
      }
      c.n += 1;
      return c.n <= max;
    },
  };
}

/** Resumos de credencial conferidos há pouco (pulam o teto de não conferidos). */
export function createVerifiedSet(ttlMs: number, maxKeys = 10_000) {
  const until = new Map<string, number>();
  return {
    add(key: string, now: number = Date.now()) {
      if (!until.has(key) && until.size >= maxKeys) until.clear();
      until.set(key, now + ttlMs);
    },
    has(key: string, now: number = Date.now()): boolean {
      const t = until.get(key);
      if (t === undefined) return false;
      if (t <= now) {
        until.delete(key);
        return false;
      }
      return true;
    },
    delete(key: string) {
      until.delete(key);
    },
  };
}

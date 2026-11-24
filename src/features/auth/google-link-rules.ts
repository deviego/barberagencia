/**
 * Regras puras do vínculo com Google (#171). Sem servidor nem rede, para serem testadas sozinhas.
 */

export type IdentityLike = {
  provider: string;
  identity_id?: string;
  id?: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

/** Identidade google criada há pouco (o vínculo acabou de acontecer neste login). */
export const FRESH_LINK_WINDOW_MS = 10 * 60_000;
/** Diferença máxima entre criação e último uso da identidade para contar como "criada agora". */
const SAME_MOMENT_MS = 2 * 60_000;

/**
 * Identidade google que acabou de ser ligada a uma conta que também entra por senha (e-mail).
 * null = nada a barrar (conta só com Google, ou Google ligado há tempo).
 */
export function freshGoogleNextToPassword<T extends IdentityLike>(
  identities: readonly T[] | null | undefined,
  now: number
): T | null {
  const list = identities ?? [];
  if (!list.some((i) => i.provider === "email")) return null;
  for (const g of list.filter((i) => i.provider === "google")) {
    const created = Date.parse(g.created_at ?? "");
    if (!Number.isFinite(created)) return g; // sem data confiável: trata como recém-criada
    const lastSign = Date.parse(g.last_sign_in_at ?? g.created_at ?? "");
    const sameMoment = !Number.isFinite(lastSign) || Math.abs(lastSign - created) <= SAME_MOMENT_MS;
    if (now - created <= FRESH_LINK_WINDOW_MS && sameMoment) return g;
  }
  return null;
}

/** Conta provisória que pode ser encerrada na prova de posse (todas as condições). */
export function provisionalEligible(input: {
  sessionUserId: string;
  user: { id: string; created_at?: string | null; app_metadata?: Record<string, unknown> | null; identities?: readonly IdentityLike[] | null };
  memberships: number;
  clients: number;
  now: number;
}): boolean {
  const { user } = input;
  if (!user || user.id !== input.sessionUserId) return false;
  const app = user.app_metadata ?? {};
  const providers = Array.isArray(app.providers) ? (app.providers as unknown[]) : [];
  if (app.provider !== "google") return false;
  if (providers.length !== 1 || providers[0] !== "google") return false;
  const ids = user.identities ?? [];
  if (!ids.length || ids.some((i) => i.provider !== "google")) return false;
  if (input.memberships !== 0 || input.clients !== 0) return false;
  const created = Date.parse(user.created_at ?? "");
  if (!Number.isFinite(created) || input.now - created >= 24 * 60 * 60_000) return false;
  return true;
}

/** Id de uma identidade (o Auth usa identity_id; versões antigas, id). */
export const identityKey = (i: IdentityLike): string => i.identity_id ?? i.id ?? "";

/** Lista de identidades google aprovadas que o servidor guarda no app_metadata. */
export function approvedGoogleIds(appMetadata: Record<string, unknown> | null | undefined): string[] {
  const v = appMetadata?.google_linked;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Identidade google numa conta que também entra por senha (e-mail) e que NÃO foi aprovada por
 * pedido do próprio cliente. Vale a qualquer tempo (não só logo depois do vínculo).
 * null = nada a barrar.
 */
export function unapprovedGoogleNextToPassword<T extends IdentityLike>(
  identities: readonly T[] | null | undefined,
  approved: readonly string[]
): T | null {
  const list = identities ?? [];
  if (!list.some((i) => i.provider === "email")) return null;
  return list.find((i) => i.provider === "google" && !approved.includes(identityKey(i))) ?? null;
}

/**
 * A identidade google mais nova da conta (maior created_at): a que acabou de ser ligada neste
 * fluxo. Só ela é aprovada por um pedido de vínculo; outras google não aprovadas continuam sendo
 * desfeitas pelo callback.
 */
export function newestGoogle<T extends IdentityLike>(identities: readonly T[] | null | undefined): T | null {
  const google = (identities ?? []).filter((i) => i.provider === "google");
  if (!google.length) return null;
  const at = (i: T) => {
    const t = Date.parse(i.created_at ?? "");
    return Number.isFinite(t) ? t : -Infinity;
  };
  return google.reduce((a, b) => (at(b) > at(a) ? b : a));
}

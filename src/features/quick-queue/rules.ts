import { hasEntitlement, normalizeSaasPlan } from "@/lib/entitlements";
import type { QuickQueueRoute, QuickQueueStatus, QuickQueueViewer } from "./types";

/** Regras puras da fila rápida (testáveis sem banco). */

/** Estado da barbearia lido no servidor. Nunca vai para o navegador. */
export type QuickQueueTenantState = {
  id: string;
  kind: "BARBERSHOP" | "DISTRIBUTOR";
  saasPlan: string | null;
  /** Fim do teste (tenant_contracts.trial_ends_at). null = sem teste registrado. */
  trialEndsAt: string | null;
  /** tenants.queue_enabled: a fila da barbearia está ativada. */
  queueEnabled: boolean;
  /** tenant_settings.queue_mode. */
  queueMode: "TOTEM" | "APP" | "BOTH";
  /** tenants.quick_queue_enabled (schema-51). Sem a coluna, vale false. */
  quickQueueEnabled: boolean;
};

/**
 * Endereço de barbearia aceito antes de ir ao banco: minúsculas, dígitos e hífen (o cadastro usa
 * 2 a 40; aqui a folga cobre endereços antigos). Qualquer outra coisa é NOT_FOUND.
 */
export const QUICK_QUEUE_SLUG_RE = /^[a-z0-9-]{1,63}$/;

export function isQuickQueueSlug(slug: unknown): slug is string {
  return typeof slug === "string" && QUICK_QUEUE_SLUG_RE.test(slug);
}

/**
 * Plano com fila: mesma regra do painel da fila. Durante o teste tudo é liberado; depois do
 * teste vale o recurso "queue" do plano (Essencial e Advance).
 */
export function planAllowsQueue(state: Pick<QuickQueueTenantState, "saasPlan" | "trialEndsAt">, now: Date): boolean {
  const gated = state.trialEndsAt ? new Date(state.trialEndsAt).getTime() <= now.getTime() : false;
  return !gated || hasEntitlement(normalizeSaasPlan(state.saasPlan), "queue");
}

/**
 * Fila recebendo senhas pelo link do cliente: mesma regra da tela /client/fila de hoje
 * (fila ativada e modo que aceita o celular do cliente; no modo só totem o link não dá senha).
 */
export function queueTakesTicketsFromLink(state: Pick<QuickQueueTenantState, "queueEnabled" | "queueMode">): boolean {
  return state.queueEnabled && state.queueMode !== "TOTEM";
}

/** Estado da fila rápida para uma barbearia (null = endereço sem barbearia). */
export function quickQueueStatus(state: QuickQueueTenantState | null, now: Date): QuickQueueStatus {
  if (!state || state.kind !== "BARBERSHOP") return "NOT_FOUND";
  if (!state.quickQueueEnabled) return "UNAVAILABLE";
  if (!planAllowsQueue(state, now)) return "UNAVAILABLE";
  if (!queueTakesTicketsFromLink(state)) return "UNAVAILABLE";
  return "OPEN";
}

/** Despachante: só a chave da fila rápida decide. Desligada (ou sem barbearia) = fluxo de hoje. */
export function quickQueueRoute(state: QuickQueueTenantState | null): QuickQueueRoute {
  return state && state.kind === "BARBERSHOP" && state.quickQueueEnabled ? "QUICK" : "LEGACY";
}

/**
 * Quem abriu o link. CLIENT só se a sessão tiver vínculo de cliente com ESTA barbearia;
 * cliente de outra barbearia, equipe ou master = VISITOR. HAS_TICKET entra com a #99.
 */
export function quickQueueViewer(clientTenantIds: readonly string[], tenantId: string): QuickQueueViewer {
  return clientTenantIds.includes(tenantId) ? "CLIENT" : "VISITOR";
}

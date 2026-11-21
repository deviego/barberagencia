import "server-only";
import { loadQuickQueueTenantState } from "./data";
import { quickQueueStatus, quickQueueTicketAccess } from "./rules";
import { QUICK_QUEUE_MESSAGES } from "./types";

/** Recusa de qualquer ação da fila rápida. A mensagem é a mesma em todos os casos. */
export class QuickQueueClosedError extends Error {
  constructor() {
    super(QUICK_QUEUE_MESSAGES.unavailable);
    this.name = "QuickQueueClosedError";
  }
}

export type QuickQueueOpenTenant = { tenantId: string };

/**
 * Guard de TODA ação da jornada: resolve a barbearia pelo endereço (nunca por id vindo do
 * aparelho) e confere, a cada chamada, plano com fila, fila rápida ligada e fila recebendo
 * senhas. Barbearia inexistente, sem plano, desligada ou fechada: a mesma recusa, sem dado.
 */
export async function requireQuickQueueOpen(slug: string, now: Date = new Date()): Promise<QuickQueueOpenTenant> {
  const state = await loadQuickQueueTenantState(slug);
  if (!state || quickQueueStatus(state, now) !== "OPEN") throw new QuickQueueClosedError();
  return { tenantId: state.id };
}

/**
 * Guard da senha já criada (#102): só "Minha senha" (consulta) e "Sair da fila". Barbearia do
 * endereço, existente e com fila no plano; NÃO exige fila rápida ligada nem fila aberta, para
 * quem já tem senha conseguir acompanhar e sair depois que o dono desliga. Entrar na fila,
 * telefone, nome e lista de serviços continuam com requireQuickQueueOpen.
 */
export async function requireQuickQueueTicketAccess(slug: string, now: Date = new Date()): Promise<QuickQueueOpenTenant> {
  const state = await loadQuickQueueTenantState(slug);
  if (!state || !quickQueueTicketAccess(state, now)) throw new QuickQueueClosedError();
  return { tenantId: state.id };
}

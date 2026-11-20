import { isOverLimit } from "@/lib/rate-limit";

/** Regras de anti-spam do formulário público de leads (puras, testáveis sem banco). */
export const LEAD_RATE_LIMIT = {
  /** Máximo de envios aceitos do mesmo ip_hash dentro da janela. */
  perIp: 5,
  perIpWindowMinutes: 10,
  /** Máximo de envios aceitos de todos os IPs somados na última hora. */
  globalPerHour: 60,
} as const;

/** true = recusar. Recebe quantos leads JÁ foram gravados em cada janela. */
export function isLeadRateLimited(counts: { ipRecent: number; globalLastHour: number }): boolean {
  return (
    isOverLimit(counts.ipRecent, { limit: LEAD_RATE_LIMIT.perIp }) ||
    isOverLimit(counts.globalLastHour, { limit: LEAD_RATE_LIMIT.globalPerHour })
  );
}

export const LEAD_STATUSES = ["NEW", "CONTACTED", "DISCARDED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_ORIGENS = ["landing-distribuidora"] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

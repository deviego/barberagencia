import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { LEAD_ORIGENS, type LeadOrigem } from "./rate-limit";
import { selectLeads, type LeadRow } from "./store";

export type { LeadRow };

export function parseLeadOrigem(value: string | undefined | null): LeadOrigem | null {
  return value && (LEAD_ORIGENS as readonly string[]).includes(value) ? (value as LeadOrigem) : null;
}

/** Lista de leads para /master/leads. Só MASTER; os demais recebem lista vazia. */
export async function getLeads(origem: LeadOrigem | null): Promise<LeadRow[]> {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return [];
  return selectLeads(origem);
}

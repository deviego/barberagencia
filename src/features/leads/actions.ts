"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { isUuid } from "@/lib/auth/acting";
import { LEAD_CONSENT_VERSION } from "./consent";
import { DistributorLeadSchema, LEAD_GENERIC_ERROR, leadFieldErrors, type LeadResult } from "./schema";
import { isLeadRateLimited, LEAD_STATUSES, type LeadStatus } from "./rate-limit";
import { anonymizeLeadRow, countRecentLeads, hashLeadIp, insertLead, updateLeadStatusRow } from "./store";

const GENERIC: LeadResult = { ok: false, error: LEAD_GENERIC_ERROR };

/** IP do visitante definido pela plataforma de hospedagem (Vercel), não o informado pelo cliente. */
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Formulário público "Para distribuidoras" (sem login).
 * Não cria tenant, usuário nem vínculo e não envia WhatsApp: só grava o lead
 * para o Master ver em /master/leads. Nunca loga nome/telefone.
 */
export async function submitDistributorLead(input: unknown): Promise<LeadResult> {
  // Honeypot: resposta igual à de sucesso, sem gravar nada.
  if (input && typeof input === "object" && "website" in input) {
    const hp = (input as { website?: unknown }).website;
    if (typeof hp === "string" ? hp.trim() !== "" : hp != null) return { ok: true };
  }

  const parsed = DistributorLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: leadFieldErrors(parsed.error) };
  const data = parsed.data;

  const ipHash = hashLeadIp(await clientIp());
  if (!ipHash) {
    console.error("[leads] LEAD_IP_SALT ausente ou curto; lead não gravado");
    return GENERIC;
  }

  try {
    if (isLeadRateLimited(await countRecentLeads(ipHash))) return GENERIC;
  } catch {
    console.error("[leads] falha ao checar rate limit");
    return GENERIC;
  }

  const ok = await insertLead({
    origem: "landing-distribuidora",
    name: data.name,
    company: data.company,
    city: data.city,
    state: data.state,
    whatsapp: data.whatsapp,
    barbershops_count: data.barbershopsCount,
    order_channel: data.orderChannel,
    consent_at: new Date().toISOString(),
    consent_version: LEAD_CONSENT_VERSION,
    ip_hash: ipHash,
  });
  if (!ok) {
    console.error("[leads] falha ao gravar lead");
    return GENERIC;
  }

  revalidatePath("/master/leads");
  return { ok: true };
}

async function assertMaster(): Promise<boolean> {
  const user = await getSessionUser();
  return !!user?.role && isMaster(user.role);
}

/** MASTER muda o status do lead (NEW/CONTACTED/DISCARDED). */
export async function setLeadStatus(id: string, status: LeadStatus) {
  if (!(await assertMaster())) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(id) || !(LEAD_STATUSES as readonly string[]).includes(status)) {
    return { ok: false as const, error: "Dados inválidos." };
  }
  if (!(await updateLeadStatusRow(id, status))) return { ok: false as const, error: "Não foi possível atualizar." };
  revalidatePath("/master/leads");
  return { ok: true as const };
}

/** MASTER anonimiza o lead a pedido do titular (LGPD). Não apaga a linha. */
export async function anonymizeLead(id: string) {
  if (!(await assertMaster())) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(id)) return { ok: false as const, error: "Dados inválidos." };
  if (!(await anonymizeLeadRow(id))) return { ok: false as const, error: "Não foi possível anonimizar." };
  revalidatePath("/master/leads");
  return { ok: true as const };
}

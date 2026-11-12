import "server-only";
import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAD_RATE_LIMIT, type LeadOrigem, type LeadStatus } from "./rate-limit";

/*
 * Por que service role aqui:
 * marketing_leads tem RLS ligada e NENHUMA policy para anon/authenticated (schema-35),
 * para que o formulário público não vire porta de leitura/escrita via PostgREST.
 * Então só o servidor grava (submitDistributorLead, já validado por zod + anti-spam)
 * e só o Master lê/edita (funções de data.ts/actions.ts checam isMaster ANTES de chamar).
 * Este arquivo é server-only e nunca recebe filtros vindos do client sem validação.
 */

const TABLE = "marketing_leads";

/** sha256(ip + salt). Retorna null se o salt do servidor não estiver configurado. */
export function hashLeadIp(ip: string): string | null {
  const salt = process.env.LEAD_IP_SALT;
  if (!salt || salt.length < 16) return null;
  return createHash("sha256").update(ip + salt).digest("hex");
}

/** Contagens para o rate limit persistente. Lança erro se o banco falhar (o chamador recusa). */
export async function countRecentLeads(ipHash: string): Promise<{ ipRecent: number; globalLastHour: number }> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const ipSince = new Date(now - LEAD_RATE_LIMIT.perIpWindowMinutes * 60_000).toISOString();
  const hourSince = new Date(now - 60 * 60_000).toISOString();

  const [ip, global] = await Promise.all([
    admin.from(TABLE).select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", ipSince),
    admin.from(TABLE).select("id", { count: "exact", head: true }).gte("created_at", hourSince),
  ]);
  if (ip.error || global.error) throw new Error("lead_count_failed");
  return { ipRecent: ip.count ?? 0, globalLastHour: global.count ?? 0 };
}

export type NewLeadRow = {
  origem: LeadOrigem;
  name: string;
  company: string;
  city: string;
  state: string;
  whatsapp: string;
  barbershops_count: number;
  order_channel: string;
  consent_at: string;
  consent_version: string;
  ip_hash: string;
};

export async function insertLead(row: NewLeadRow): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from(TABLE).insert(row);
  return !error;
}

export type LeadRow = {
  id: string;
  origem: string;
  name: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  barbershops_count: number | null;
  order_channel: string | null;
  consent_at: string;
  consent_version: string;
  status: LeadStatus;
  anonymized_at: string | null;
  created_at: string;
};

/** Uso exclusivo do Master (o chamador checa isMaster). Nunca devolve ip_hash. */
export async function selectLeads(origem: LeadOrigem | null, limit = 200): Promise<LeadRow[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from(TABLE)
    .select("id, origem, name, company, city, state, whatsapp, barbershops_count, order_channel, consent_at, consent_version, status, anonymized_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (origem) q = q.eq("origem", origem);
  const { data, error } = await q;
  if (error) throw new Error("lead_list_failed");
  return (data ?? []) as LeadRow[];
}

export async function updateLeadStatusRow(id: string, status: LeadStatus): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from(TABLE).update({ status }).eq("id", id);
  return !error;
}

/** Pedido do titular (LGPD): apaga os dados pessoais, mantém a linha para contagem. */
export async function anonymizeLeadRow(id: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from(TABLE)
    .update({
      name: null,
      company: null,
      city: null,
      whatsapp: null,
      ip_hash: null,
      status: "DISCARDED",
      anonymized_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("anonymized_at", null);
  return !error;
}

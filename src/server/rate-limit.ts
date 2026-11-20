import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RateRule } from "@/lib/rate-limit";

/*
 * Por que service role aqui:
 * rate_limit_events tem RLS ligada e NENHUMA policy (schema-50), e rate_limit_hit só
 * pode ser executada pelo service_role. Este arquivo é server-only; escopo e chave são
 * montados no servidor, nunca recebidos do navegador.
 */

/**
 * sha256(ip + sal). Retorna null se o sal do servidor (RATE_LIMIT_IP_SALT) não estiver configurado.
 * O formulário de leads usa um sal próprio (LEAD_IP_SALT, em features/leads/store.ts).
 */
export function hashIp(ip: string): string | null {
  const salt = process.env.RATE_LIMIT_IP_SALT;
  if (!salt || salt.length < 32) return null;
  return createHash("sha256").update(ip + salt).digest("hex");
}

/** IP do visitante definido pela plataforma de hospedagem (Vercel), não o informado pelo cliente. */
export async function requestIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult = "ok" | "limited" | "unavailable";

/**
 * Registra uma tentativa de (escopo, chave) e diz se ela cabe no limite.
 * "unavailable" = não foi possível conferir (ex.: schema-50 não aplicada). Quem chama decide
 * se recusa; as ações do totem recusam.
 */
export async function hitRateLimit(scope: string, key: string, rule: RateRule): Promise<RateLimitResult> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_scope: scope,
      p_key: key,
      p_window_seconds: rule.windowSeconds,
      p_limit: rule.limit,
    });
    if (error) {
      console.error(`[rate-limit] ${scope}: conferência indisponível (${error.code ?? "sem código"}). A migration schema-50 foi aplicada?`);
      return "unavailable";
    }
    return data === true ? "ok" : "limited";
  } catch {
    console.error(`[rate-limit] ${scope}: conferência indisponível`);
    return "unavailable";
  }
}

import "server-only";
import { SupabaseEnvError, resolveSupabasePublicEnv, type SupabaseEnvVars, type SupabaseTarget } from "@/lib/supabase/env";

/**
 * Endereço e segredo do gateway de WhatsApp para o ambiente atual. Só no servidor.
 *
 * O ambiente é decidido pela MESMA função do Supabase (lib/supabase/env.ts), com as mesmas
 * conferências. Onde o Supabase recusa, o WhatsApp fica desligado.
 *   - homologação (preview) → somente STAGING_WA_SERVICE_URL + STAGING_WA_SERVICE_TOKEN (as duas
 *     ou nada). WA_SERVICE_* nem são lidas.
 *   - padrão (produção e local) → somente WA_SERVICE_URL + WA_SERVICE_TOKEN, como sempre foi.
 *
 * null = gateway não configurado: quem chama pula o envio (já era assim com a variável vazia).
 */

export type WaEnvVars = SupabaseEnvVars & {
  readonly WA_SERVICE_URL?: string;
  readonly WA_SERVICE_TOKEN?: string;
  readonly STAGING_WA_SERVICE_URL?: string;
  readonly STAGING_WA_SERVICE_TOKEN?: string;
};

export type WaGatewayEnv = { url: string; token: string };

/** Função pura: recebe o env e devolve o gateway do ambiente, ou null. */
export function resolveWaGatewayEnv(env: WaEnvVars): WaGatewayEnv | null {
  let target: SupabaseTarget;
  try {
    target = resolveSupabasePublicEnv(env).target;
  } catch (e) {
    // Ambiente recusado: nada de WhatsApp. Registra o motivo (a mensagem só cita nomes de
    // variável, nunca valores) para "WhatsApp não envia" ter explicação no log.
    const reason = e instanceof SupabaseEnvError ? e.message : "erro ao resolver o ambiente";
    console.error(`[wa-env] gateway de WhatsApp desligado: ${reason}`);
    return null;
  }
  const url = target === "staging" ? env.STAGING_WA_SERVICE_URL : env.WA_SERVICE_URL;
  const token = target === "staging" ? env.STAGING_WA_SERVICE_TOKEN : env.WA_SERVICE_TOKEN;
  return url && token ? { url, token } : null;
}

// Getters: a leitura é sob demanda, então cada ambiente só toca nas próprias variáveis.
const runtimeEnv: WaEnvVars = {
  get NODE_ENV() {
    return process.env.NODE_ENV;
  },
  get VERCEL_ENV() {
    return process.env.VERCEL_ENV;
  },
  get NEXT_PUBLIC_VERCEL_ENV() {
    return process.env.NEXT_PUBLIC_VERCEL_ENV;
  },
  get NEXT_PUBLIC_SUPABASE_URL() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  },
  get NEXT_PUBLIC_STAGING_SUPABASE_URL() {
    return process.env.NEXT_PUBLIC_STAGING_SUPABASE_URL;
  },
  get NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY() {
    return process.env.NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY;
  },
  get WA_SERVICE_URL() {
    return process.env.WA_SERVICE_URL;
  },
  get WA_SERVICE_TOKEN() {
    return process.env.WA_SERVICE_TOKEN;
  },
  get STAGING_WA_SERVICE_URL() {
    return process.env.STAGING_WA_SERVICE_URL;
  },
  get STAGING_WA_SERVICE_TOKEN() {
    return process.env.STAGING_WA_SERVICE_TOKEN;
  },
};

export function waGatewayEnv(): WaGatewayEnv | null {
  return resolveWaGatewayEnv(runtimeEnv);
}

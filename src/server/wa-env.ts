import "server-only";

/**
 * Endereço e segredo do gateway de WhatsApp para o ambiente atual. Só no servidor.
 *
 * Regras (a decisão é só por VERCEL_ENV, como em lib/supabase/env.ts):
 *   - preview do Vercel → somente STAGING_WA_SERVICE_URL + STAGING_WA_SERVICE_TOKEN (as duas
 *     ou nada). WA_SERVICE_* nem são lidas. Sem as duas, WhatsApp desligado no preview.
 *   - produção e local  → somente WA_SERVICE_URL + WA_SERVICE_TOKEN, como sempre foi.
 *
 * null = gateway não configurado: quem chama pula o envio (já era assim com a variável vazia).
 */

export type WaEnvVars = {
  readonly VERCEL_ENV?: string;
  readonly WA_SERVICE_URL?: string;
  readonly WA_SERVICE_TOKEN?: string;
  readonly STAGING_WA_SERVICE_URL?: string;
  readonly STAGING_WA_SERVICE_TOKEN?: string;
};

export type WaGatewayEnv = { url: string; token: string };

/** Função pura: recebe o env e devolve o gateway do ambiente, ou null. */
export function resolveWaGatewayEnv(env: WaEnvVars): WaGatewayEnv | null {
  if (env.VERCEL_ENV === "preview") {
    const url = env.STAGING_WA_SERVICE_URL;
    const token = env.STAGING_WA_SERVICE_TOKEN;
    return url && token ? { url, token } : null;
  }
  const url = env.WA_SERVICE_URL;
  const token = env.WA_SERVICE_TOKEN;
  return url && token ? { url, token } : null;
}

// Getters: a leitura é sob demanda, então cada ambiente só toca nas próprias variáveis.
const runtimeEnv: WaEnvVars = {
  get VERCEL_ENV() {
    return process.env.VERCEL_ENV;
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

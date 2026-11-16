// Conferência do ambiente de homologação na hora do BUILD (chamada pelo next.config.mjs).
// JavaScript puro de propósito: o next.config.mjs não importa TypeScript.
// As regras são as mesmas de src/lib/supabase/env.ts, env.server.ts e src/server/wa-env.ts;
// scripts/test-supabase-env.mjs confere que os dois lados concordam.

/** Manter igual a PRODUCTION_SUPABASE_HOST em src/lib/supabase/env.ts (o teste confere). */
export const PRODUCTION_SUPABASE_HOST = "tusfxbnnrypjtzqcvpov.supabase.co";

const REQUIRED = [
  "NEXT_PUBLIC_STAGING_SUPABASE_URL",
  "NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY",
  "STAGING_SUPABASE_SERVICE_ROLE_KEY",
];

const PRODUCTION_SUPABASE_REF = PRODUCTION_SUPABASE_HOST.split(".")[0];

/** Host da URL sem ponto final e em minúsculas; null se a URL não dá para ler. */
function hostOf(url) {
  try {
    // "host." (com ponto final) é o mesmo destino de "host".
    return new URL(url).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return null;
  }
}
const isProductionHost = (host) => host === PRODUCTION_SUPABASE_HOST || host.split(".")[0] === PRODUCTION_SUPABASE_REF;

/** Lista de problemas (só nomes de variável, nunca valores). */
export function previewEnvProblems(env) {
  // Build no Vercel sem VERCEL_ENV: não dá para saber o ambiente, e o preview seria tratado
  // como local (nomes padrão). Recusa em vez de seguir.
  if (env.VERCEL && !env.VERCEL_ENV) {
    return ["VERCEL_ENV ausente em build no Vercel (as variáveis de sistema precisam estar expostas ao projeto)"];
  }
  if (env.VERCEL_ENV !== "preview") {
    // Trava que não depende de VERCEL_ENV existir: o projeto de produção só é aceito com
    // VERCEL_ENV=production ou em modo de desenvolvimento (next dev).
    const host = env.NEXT_PUBLIC_SUPABASE_URL ? hostOf(env.NEXT_PUBLIC_SUPABASE_URL) : null;
    if (host && isProductionHost(host) && env.VERCEL_ENV !== "production" && env.NODE_ENV !== "development") {
      return ["NEXT_PUBLIC_SUPABASE_URL aponta para o projeto de produção, mas VERCEL_ENV não é production"];
    }
    return [];
  }
  const problems = REQUIRED.filter((name) => !env[name]).map((name) => `${name} ausente`);

  const url = env.NEXT_PUBLIC_STAGING_SUPABASE_URL;
  if (url) {
    const host = hostOf(url);
    if (host === null) problems.push("NEXT_PUBLIC_STAGING_SUPABASE_URL não é uma URL válida");
    else if (isProductionHost(host)) {
      problems.push("NEXT_PUBLIC_STAGING_SUPABASE_URL aponta para o projeto de produção");
    }
  }

  // WhatsApp é opcional no preview, mas as duas variáveis andam juntas.
  if (Boolean(env.STAGING_WA_SERVICE_URL) !== Boolean(env.STAGING_WA_SERVICE_TOKEN)) {
    problems.push("STAGING_WA_SERVICE_URL e STAGING_WA_SERVICE_TOKEN: defina as duas ou nenhuma");
  }
  return problems;
}

export function assertPreviewEnv(env) {
  const problems = previewEnvProblems(env);
  if (problems.length) {
    throw new Error(
      `Build recusado: ambiente de homologação incompleto ou ambiente indefinido.\n- ${problems.join("\n- ")}\n` +
        "Só a produção declarada (VERCEL_ENV=production) usa o projeto de produção."
    );
  }
  // Rastro no log do build (só nomes, nunca valores).
  if (env.VERCEL_ENV === "preview") {
    const wa = env.STAGING_WA_SERVICE_URL ? "ligado (STAGING_WA_SERVICE_URL, STAGING_WA_SERVICE_TOKEN)" : "desligado";
    console.log(`[check-preview-env] VERCEL_ENV=preview; destino: homologação; presentes: ${REQUIRED.join(", ")}; WhatsApp: ${wa}`);
  } else if (env.VERCEL) {
    console.log(`[check-preview-env] VERCEL_ENV=${env.VERCEL_ENV}; destino: padrão (fora do preview)`);
  }
}

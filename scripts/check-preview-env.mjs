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

/** Lista de problemas (só nomes de variável, nunca valores). Fora do preview: sempre vazia. */
export function previewEnvProblems(env) {
  if (env.VERCEL_ENV !== "preview") return [];
  const problems = REQUIRED.filter((name) => !env[name]).map((name) => `${name} ausente`);

  const url = env.NEXT_PUBLIC_STAGING_SUPABASE_URL;
  if (url) {
    let host = null;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      /* host fica null */
    }
    if (host === null) problems.push("NEXT_PUBLIC_STAGING_SUPABASE_URL não é uma URL válida");
    else if (host === PRODUCTION_SUPABASE_HOST) {
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
      `Build de preview recusado: ambiente de homologação incompleto.\n- ${problems.join("\n- ")}\n` +
        "O preview não usa as variáveis de produção."
    );
  }
  // Rastro no log do build (só nomes, nunca valores).
  if (env.VERCEL_ENV === "preview") {
    const wa = env.STAGING_WA_SERVICE_URL ? "ligado (STAGING_WA_SERVICE_URL, STAGING_WA_SERVICE_TOKEN)" : "desligado";
    console.log(`[check-preview-env] VERCEL_ENV=preview; presentes: ${REQUIRED.join(", ")}; WhatsApp: ${wa}`);
  }
}

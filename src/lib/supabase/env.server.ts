import "server-only";
import {
  SupabaseEnvError,
  onPreviewWithoutStaging,
  resolveSupabasePublicEnv,
  type SupabaseEnvVars,
} from "./env";

/**
 * Parte SERVER-ONLY da resolução de ambiente: a chave de service role.
 * Separada de ./env.ts para que nenhum arquivo importável pelo navegador cite essa chave.
 */

export type SupabaseServerEnvVars = SupabaseEnvVars & {
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly STAGING_SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type SupabaseAdminEnv = { target: "staging" | "default"; url: string; serviceRoleKey: string };

/** Função pura: URL + service role do mesmo destino da parte pública. */
export function resolveSupabaseAdminEnv(env: SupabaseServerEnvVars): SupabaseAdminEnv {
  // A parte pública vem primeiro: em preview ela já recusa se faltar URL/anon key ou se a URL
  // for a de produção, então a service role nunca é combinada com outro ambiente.
  const { target, url } = resolveSupabasePublicEnv(env);

  if (target === "staging") {
    const serviceRoleKey = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return onPreviewWithoutStaging(["STAGING_SUPABASE_SERVICE_ROLE_KEY"]);
    return { target, url, serviceRoleKey };
  }

  // Produção e local: só o nome de sempre; a STAGING_* não é lida.
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new SupabaseEnvError("SUPABASE_SERVICE_ROLE_KEY ausente");
  return { target, url, serviceRoleKey };
}

const runtimeEnv: SupabaseServerEnvVars = {
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
  get SUPABASE_SERVICE_ROLE_KEY() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },
  get STAGING_SUPABASE_SERVICE_ROLE_KEY() {
    return process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  },
};

/** URL + service role do ambiente atual. Só no servidor. */
export function supabaseAdminEnv(): SupabaseAdminEnv {
  return resolveSupabaseAdminEnv(runtimeEnv);
}

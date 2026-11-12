/**
 * Resolução do ambiente do Supabase (parte PÚBLICA: URL + anon key).
 *
 * Sem dependência de Node: este arquivo é importado pelo navegador, pelo servidor e pelo
 * middleware (edge). A chave de service role fica em ./env.server.ts (server-only).
 *
 * Regras (a decisão é só por VERCEL_ENV):
 *   - preview do Vercel  → somente NEXT_PUBLIC_STAGING_SUPABASE_*; os nomes padrão nem são lidos.
 *   - produção           → somente NEXT_PUBLIC_SUPABASE_*; as STAGING_* nem são lidas.
 *   - local (sem Vercel) → NEXT_PUBLIC_SUPABASE_*, como sempre foi.
 *   - preview sem qualquer uma das STAGING_* → recusa (tudo ou nada; nunca mistura ambientes).
 *   - preview com a URL do projeto de produção → recusa.
 *   - o projeto de produção só é aceito com VERCEL_ENV=production ou em modo de desenvolvimento
 *     (next dev). Vale mesmo se VERCEL_ENV não existir: um preview sem as variáveis de sistema
 *     não cai no banco de produção.
 *
 * O build de preview também quebra nesses casos: ver scripts/check-preview-env.mjs (next.config.mjs).
 */

/**
 * Host do projeto de produção (público; é o mesmo de DEPLOY.md e render.yaml).
 * Manter igual a PRODUCTION_SUPABASE_HOST em scripts/check-preview-env.mjs (o teste confere).
 */
export const PRODUCTION_SUPABASE_HOST = "tusfxbnnrypjtzqcvpov.supabase.co";

/** Identificador do projeto de produção (primeiro rótulo do host). */
const PRODUCTION_SUPABASE_REF = PRODUCTION_SUPABASE_HOST.split(".")[0];

/** "production" se o host é do projeto de produção, "other" se não é, "invalid" se a URL não dá para ler. */
export function supabaseUrlKind(url: string): "production" | "other" | "invalid" {
  let host: string;
  try {
    // "host." (com ponto final) é o mesmo destino de "host".
    host = new URL(url).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return "invalid";
  }
  return host === PRODUCTION_SUPABASE_HOST || host.split(".")[0] === PRODUCTION_SUPABASE_REF ? "production" : "other";
}

/** true se a URL aponta para o projeto de produção (ou não dá para ler o host dela). */
export function isProductionSupabaseUrl(url: string): boolean {
  return supabaseUrlKind(url) !== "other";
}

export type SupabaseEnvVars = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
  readonly NEXT_PUBLIC_VERCEL_ENV?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_STAGING_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY?: string;
};

export type SupabaseTarget = "staging" | "default";
export type SupabasePublicEnv = { target: SupabaseTarget; url: string; anonKey: string };

export class SupabaseEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseEnvError";
  }
}

/**
 * Decide o destino só por VERCEL_ENV. No navegador essa variável não existe; lá vale
 * NEXT_PUBLIC_VERCEL_ENV, que é uma cópia de VERCEL_ENV gravada no bundle na hora do build
 * (next.config.mjs). Se as duas existem e discordam sobre "preview", o build foi feito para
 * um ambiente e está rodando em outro: recusa.
 */
export function supabaseTarget(env: Pick<SupabaseEnvVars, "VERCEL_ENV" | "NEXT_PUBLIC_VERCEL_ENV">): SupabaseTarget {
  const server = env.VERCEL_ENV || undefined;
  const client = env.NEXT_PUBLIC_VERCEL_ENV || undefined;
  if (server === undefined) return client === "preview" ? "staging" : "default";
  if ((server === "preview") !== (client === "preview")) {
    throw new SupabaseEnvError(
      "Ambiente inconsistente: VERCEL_ENV e NEXT_PUBLIC_VERCEL_ENV discordam. " +
        "O build foi feito para outro ambiente; refaça o deploy."
    );
  }
  return server === "preview" ? "staging" : "default";
}

/**
 * Preview sem as variáveis de staging. Política atual: recusar com erro claro.
 * Fica isolada aqui para ser trocada num lugar só, se a decisão mudar.
 */
export function onPreviewWithoutStaging(missing: readonly string[]): never {
  throw new SupabaseEnvError(
    `Preview sem ambiente de homologação configurado. Faltando: ${missing.join(", ")}. ` +
      "O preview não usa as variáveis de produção."
  );
}

/** Função pura: recebe o env e devolve URL + anon key do destino certo. */
export function resolveSupabasePublicEnv(env: SupabaseEnvVars): SupabasePublicEnv {
  const target = supabaseTarget(env);

  if (target === "staging") {
    const url = env.NEXT_PUBLIC_STAGING_SUPABASE_URL;
    const anonKey = env.NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY;
    const missing = [
      !url && "NEXT_PUBLIC_STAGING_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY",
    ].filter((v): v is string => Boolean(v));
    if (!url || !anonKey) return onPreviewWithoutStaging(missing);
    if (isProductionSupabaseUrl(url)) {
      throw new SupabaseEnvError(
        "NEXT_PUBLIC_STAGING_SUPABASE_URL não é uma URL válida ou aponta para o projeto de produção. " +
          "O preview precisa de um projeto próprio."
      );
    }
    return { target, url, anonKey };
  }

  // Produção e local: só os nomes de sempre. Daqui para baixo nenhuma STAGING_* é lida.
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_URL ausente");
  if (!anonKey) throw new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_ANON_KEY ausente");
  // Trava que não depende de VERCEL_ENV existir: o projeto de produção só é aceito em produção
  // declarada (no navegador vale a cópia gravada no build) ou em modo de desenvolvimento.
  const declared = env.VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV;
  if (supabaseUrlKind(url) === "production" && declared !== "production" && env.NODE_ENV !== "development") {
    throw new SupabaseEnvError(
      "NEXT_PUBLIC_SUPABASE_URL aponta para o projeto de produção, mas VERCEL_ENV não é production. " +
        "Fora da produção esse projeto só é aceito em modo de desenvolvimento."
    );
  }
  return { target, url, anonKey };
}

/*
 * Env real. Cada NEXT_PUBLIC_* está escrita por extenso porque o Next só grava no bundle do
 * navegador as referências literais (acesso dinâmico por nome não funciona no cliente).
 * São getters para a leitura ser sob demanda: em produção os de STAGING_* nunca são chamados.
 */
const runtimeEnv: SupabaseEnvVars = {
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
};

/** URL + anon key do ambiente atual (navegador, servidor e middleware). */
export function supabasePublicEnv(): SupabasePublicEnv {
  return resolveSupabasePublicEnv(runtimeEnv);
}

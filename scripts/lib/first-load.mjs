// Primeira carga do staging: lê o snippet de variáveis copiado do Vercel ("Copy Snippet") e escolhe,
// só em memória, o destino do banco e da Admin API. Sem efeitos colaterais (testável sem banco).
//
// Regras:
// - Nenhuma mensagem de erro contém VALOR do snippet, só nomes de variáveis.
// - Banco: só o pooler de SESSÃO (porta 5432), que funciona em rede IPv4. A conexão direta
//   (db.<ref>.supabase.co) é IPv6 e nunca é escolhida. Se o snippet só trouxer o pooler de transação
//   (6543), a URL de sessão é derivada dele (mesmo host e usuário, porta 5432).
// - O destino passa pelas MESMAS guardas do bootstrap (stagingTarget): allowlist pela ref de staging,
//   ref de produção recusada, SSL verificado com a CA do Supabase.
// - Admin API: a URL tem de ser exatamente https://<ref de staging>.supabase.co e a chave service_role,
//   quando for JWT, tem de ser dessa mesma ref.
import { parse } from "pg-connection-string";
import { stagingTarget, localTarget, GuardError, PROD_PROJECT_REF } from "./schema-apply.mjs";

export const STAGING_PROJECT_REF = "fscujfbgfbiknhjvfqif";
const POOLER = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** KEY=VALOR por linha (aceita `export `, aspas simples/duplas, comentários e linhas vazias). */
export function parseSnippet(text) {
  const vars = new Map();
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const m = raw.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.endsWith(q) && v.length >= 2) v = v.slice(1, -1);
    if (v) vars.set(m[1], v);
  }
  if (vars.size === 0)
    throw new GuardError(
      "A área de transferência não tem variáveis NOME=valor. No Vercel, abra o banco de staging e clique em " +
        '"Copy Snippet" logo antes de rodar o comando.'
    );
  return vars;
}

const isPg = (v) => /^postgres(ql)?:\/\//i.test(v);

function hostPort(v) {
  try {
    const c = parse(v);
    return { host: String(c.host ?? "").toLowerCase(), port: c.port ? Number(c.port) : 5432 };
  } catch {
    return { host: "", port: 0 };
  }
}

/** Escolhe a URL do pooler de sessão (5432). Devolve { url, from, derived }. */
function pickSessionPooler(vars) {
  const poolers = [...vars].filter(([, v]) => isPg(v)).map(([k, v]) => ({ k, v, ...hostPort(v) })).filter((c) => POOLER.test(c.host));
  const session = poolers.find((c) => c.port === 5432);
  if (session) return { url: session.v, from: session.k, derived: false };
  const tx = poolers.find((c) => c.port === 6543);
  if (tx) {
    let u;
    try {
      u = new URL(tx.v);
    } catch {
      throw new GuardError(`Não consegui ler a URL da variável ${tx.k}.`);
    }
    u.port = "5432";
    u.search = "";
    return { url: u.toString(), from: tx.k, derived: true };
  }
  throw new GuardError(
    "O snippet não tem nenhuma URL do pooler (aws-N-<região>.pooler.supabase.com). A conexão direta não serve " +
      "(é IPv6). Confira se copiou o snippet do banco de staging."
  );
}

function findBySuffix(vars, suffixes) {
  for (const s of suffixes) for (const [k, v] of vars) if (k === s || k.endsWith(`_${s}`)) return { k, v };
  return null;
}

/** Payload de um JWT (sem validar assinatura), ou null se não for JWT. */
function jwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function pickApi(vars, { local }) {
  const urls = [...vars].filter(([k]) => /(^|_)SUPABASE_URL$/.test(k));
  if (urls.length === 0) throw new GuardError("O snippet não tem a variável ...SUPABASE_URL.");
  const expected = `https://${STAGING_PROJECT_REF}.supabase.co`;
  let apiUrl;
  for (const [k, v] of urls) {
    let u;
    try {
      u = new URL(v);
    } catch {
      throw new GuardError(`A variável ${k} não é uma URL.`);
    }
    if (local) {
      if (u.protocol !== "http:" || !LOOPBACK.has(u.hostname))
        throw new GuardError(`Modo --local: ${k} tem de ser http://127.0.0.1:<porta>.`);
    } else {
      if (u.hostname.toLowerCase().includes(PROD_PROJECT_REF)) throw new GuardError(`ABORTADO: ${k} aponta para PRODUÇÃO.`);
      if (u.origin !== expected || !["", "/"].includes(u.pathname))
        throw new GuardError(`${k} não é o projeto de staging (esperado ${expected}).`);
    }
    if (apiUrl && apiUrl !== u.origin) throw new GuardError("O snippet tem ...SUPABASE_URL diferentes entre si.");
    apiUrl = u.origin;
  }

  const key = findBySuffix(vars, ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]);
  if (!key) throw new GuardError("O snippet não tem ...SUPABASE_SERVICE_ROLE_KEY (precisa dela para criar os usuários de teste).");
  const payload = jwtPayload(key.v);
  if (payload) {
    if (payload.role !== "service_role") throw new GuardError(`${key.k} não é uma chave service_role.`);
    if (!local) {
      if (payload.ref === PROD_PROJECT_REF) throw new GuardError(`ABORTADO: ${key.k} é da PRODUÇÃO.`);
      if (payload.ref !== STAGING_PROJECT_REF) throw new GuardError(`${key.k} não é do projeto de staging.`);
    }
  }
  return { apiUrl, serviceKey: key.v, apiFrom: key.k };
}

/**
 * Do snippet para os destinos já validados.
 * @param {string} text conteúdo da área de transferência
 * @param {{local?: boolean, caPath?: string}} o  local = Supabase LOCAL (loopback), só para teste
 * @returns {{db: import("pg").ClientConfig, dbFrom: string, dbDerived: boolean, apiUrl: string, serviceKey: string, apiFrom: string}}
 */
export function targetsFromSnippet(text, { local = false, caPath } = {}) {
  const vars = parseSnippet(text);
  let db, dbFrom, dbDerived = false;
  if (local) {
    const c = [...vars].find(([, v]) => isPg(v) && LOOPBACK.has(hostPort(v).host));
    if (!c) throw new GuardError("Modo --local: o snippet não tem URL de banco em 127.0.0.1/localhost.");
    db = localTarget(c[1]);
    dbFrom = c[0];
  } else {
    const p = pickSessionPooler(vars);
    db = stagingTarget({ url: p.url, projectRef: STAGING_PROJECT_REF, caPath });
    if (db.port !== 5432 || !POOLER.test(db.host)) throw new GuardError("Destino não é o pooler de sessão (5432).");
    dbFrom = p.from;
    dbDerived = p.derived;
  }
  return { db, dbFrom, dbDerived, ...pickApi(vars, { local }) };
}

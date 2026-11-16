// Módulo ÚNICO usado por scripts/bootstrap-staging.mjs (staging) e scripts/ci/apply-schema.mjs (CI local),
// para os dois não divergirem: parse da URL, guardas de destino, SSL, validação do manifesto,
// guarda de banco vazio e aplicação dos supabase/schema*.sql na ordem de supabase/ci-order.txt.
//
// Regras (revisão de segurança da Navalha, PR fix/bootstrap-staging-ordem):
// - A URL é lida com pg-connection-string (o mesmo parser do pg). Host e usuário são comparados em
//   minúsculas, já decodificados. Parâmetros ?host= / ?hostaddr= são recusados.
// - O cliente pg recebe os campos JÁ VALIDADOS (host, porta, usuário...), nunca a connection string,
//   então o host conferido é exatamente o host usado (e sslmode da URL não desliga o SSL).
// - Staging: allowlist pelo STAGING_PROJECT_REF (host db.<ref>.supabase.co ou pooler com usuário
//   postgres.<ref>); a ref de produção é recusada em qualquer lugar. SSL com verificação + CA do Supabase.
// - Local (CI/prova): só loopback (127.0.0.1, localhost, ::1), sem SSL.
// - Antes de aplicar qualquer coisa: se o schema public já tiver alguma tabela, aborta (fail closed).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { parse } from "pg-connection-string";

export const PROD_PROJECT_REF = "tusfxbnnrypjtzqcvpov";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const SUPABASE_REF = /^[a-z0-9]{20}$/;

export class GuardError extends Error {}

const norm = (v) => {
  if (v == null) return "";
  let s = String(v);
  try {
    s = decodeURIComponent(s);
  } catch {
    throw new GuardError("URL com percent-encoding inválido.");
  }
  return s.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1"); // [::1] → ::1
};

/** Lê a URL e devolve só os campos que o pg vai usar. Recusa ?host= e ?hostaddr=. */
function parseUrl(url) {
  if (!url) throw new GuardError("Faltou a URL do banco.");
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  let sslmode = "";
  for (const [key, value] of new URLSearchParams(query)) {
    const k = key.toLowerCase();
    if (["host", "hostaddr"].includes(k))
      throw new GuardError(`Parâmetro ?${key}= não é aceito na URL (o host vem só da parte antes do "?").`);
    if (k === "sslmode") sslmode = value.toLowerCase();
    if (k === "ssl" && ["0", "false"].includes(value.toLowerCase())) sslmode = "disable";
  }
  const c = parse(url);
  if (c.hostaddr) throw new GuardError("Parâmetro hostaddr não é aceito.");
  const host = norm(c.host);
  if (!host || host.startsWith("/")) throw new GuardError("Host ausente ou socket unix: não aceito.");
  return {
    host,
    port: c.port ? Number(c.port) : 5432,
    user: norm(c.user),
    password: c.password ?? "",
    database: c.database || "postgres",
    sslmode,
  };
}

/**
 * Destino LOCAL (CI e prova em docker): só loopback, sem SSL.
 * @returns pg.ClientConfig
 */
export function localTarget(url) {
  const t = parseUrl(url);
  if (!LOOPBACK.has(t.host)) throw new GuardError(`"${t.host}" não é loopback. Este modo só roda em banco local.`);
  if (t.user.includes(PROD_PROJECT_REF)) throw new GuardError("Usuário com a ref de PRODUÇÃO.");
  return { host: t.host, port: t.port, user: t.user, password: t.password, database: t.database, ssl: false };
}

/**
 * Destino STAGING (Supabase cloud): allowlist pela ref do projeto de staging + SSL verificado com a CA.
 * @param {{url: string, projectRef: string, caPath: string}} p
 * @returns pg.ClientConfig
 */
export function stagingTarget({ url, projectRef, caPath }) {
  const ref = norm(projectRef);
  if (!SUPABASE_REF.test(ref)) throw new GuardError("STAGING_PROJECT_REF ausente ou inválida (20 letras/números).");
  if (ref === PROD_PROJECT_REF) throw new GuardError("STAGING_PROJECT_REF é a ref de PRODUÇÃO.");

  const t = parseUrl(url);
  if (t.host.includes(PROD_PROJECT_REF) || t.user.includes(PROD_PROJECT_REF))
    throw new GuardError("ABORTADO: a URL contém a ref de PRODUÇÃO.");

  const direct = t.host === `db.${ref}.supabase.co` && t.user === "postgres";
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(t.host) && t.user === `postgres.${ref}`;
  if (!direct && !pooler)
    throw new GuardError(
      `Destino fora da allowlist. Aceito só db.${ref}.supabase.co (usuário postgres) ou o pooler ` +
        `aws-N-<região>.pooler.supabase.com com usuário postgres.${ref}.`
    );

  if (["disable", "allow", "prefer", "no-verify"].includes(t.sslmode))
    throw new GuardError(`sslmode=${t.sslmode} não é aceito para banco remoto (o SSL é sempre verificado).`);
  if (!caPath) throw new GuardError("SUPABASE_CA_CERT ausente (caminho do prod-ca-2021.crt; ver STAGING.md).");
  let ca;
  try {
    ca = fs.readFileSync(caPath, "utf8");
  } catch {
    throw new GuardError(`Não consegui ler SUPABASE_CA_CERT (${caPath}).`);
  }
  if (!ca.includes("BEGIN CERTIFICATE")) throw new GuardError("SUPABASE_CA_CERT não parece um certificado PEM.");

  return {
    host: t.host,
    port: t.port,
    user: t.user,
    password: t.password,
    database: t.database,
    ssl: { rejectUnauthorized: true, ca, servername: t.host },
  };
}

/** Lê supabase/ci-order.txt e confere que bate exatamente com os supabase/schema*.sql. */
export function loadManifest(dir = path.resolve("supabase")) {
  const order = fs.readFileSync(path.join(dir, "ci-order.txt"), "utf8").split(/\s+/).filter(Boolean);
  const onDisk = fs.readdirSync(dir).filter((f) => f.startsWith("schema") && f.endsWith(".sql"));
  const problems = [];
  const notListed = onDisk.filter((f) => !order.includes(f));
  const notFound = order.filter((f) => !onDisk.includes(f));
  const notSchema = order.filter((f) => !/^schema[\w-]*\.sql$/.test(f));
  const dupes = order.filter((f, i) => order.indexOf(f) !== i);
  if (notListed.length) problems.push(`Fora do ci-order.txt: ${notListed.join(", ")} (adicione na posição certa)`);
  if (notFound.length) problems.push(`No ci-order.txt mas não existe: ${notFound.join(", ")}`);
  if (notSchema.length) problems.push(`Só schema*.sql pode entrar (seeds nunca): ${notSchema.join(", ")}`);
  if (dupes.length) problems.push(`Repetidos no ci-order.txt: ${dupes.join(", ")}`);
  if (problems.length) throw new GuardError(problems.join("\n✗ "));
  return { dir, files: order };
}

/** Conecta mostrando só a mensagem do erro (nunca a URL/config). */
export async function connect(config) {
  const client = new pg.Client(config);
  try {
    await client.connect();
  } catch (e) {
    throw new GuardError(`Falha ao conectar: ${e?.message ?? "erro desconhecido"}`);
  }
  return client;
}

/** Fail closed: aborta se o schema public já tiver QUALQUER tabela (protege prod e bancos em uso). */
export async function assertEmptyPublic(client) {
  const { rows } = await client.query("select count(*)::int as n from pg_tables where schemaname = 'public'");
  if (rows[0].n > 0)
    throw new GuardError(`ABORTADO: o schema public já tem ${rows[0].n} tabela(s). Só aplico em banco VAZIO.`);
}

/** Aplica os arquivos em 1 passada, cada um numa transação; para no primeiro erro. */
export async function applyAll(client, { dir, files }, log = console.log) {
  const t0 = Date.now();
  for (const [i, f] of files.entries()) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      log(`  ✓ ${String(i + 1).padStart(2)} ${f}`);
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw new GuardError(
        `PAROU em ${f} (${i + 1}/${files.length}): ${e.message.split("\n")[0]}\n` +
          "Nada depois dele foi aplicado. O banco precisa estar vazio; corrija e recrie."
      );
    }
  }
  log(`\n✓ ${files.length} arquivos aplicados (${Date.now() - t0} ms).`);
}

/** Fluxo completo: valida manifesto → conecta → banco vazio? → aplica. Imprime erro e sai com 1. */
export async function run(config, { label }) {
  let client;
  try {
    const manifest = loadManifest();
    console.log(`${label}: ${manifest.files.length} arquivos na ordem de supabase/ci-order.txt (1 passada).`);
    client = await connect(config);
    await assertEmptyPublic(client);
    await applyAll(client, manifest);
  } catch (e) {
    console.error(`\n✗ ${e instanceof GuardError ? e.message : e?.message ?? e}`);
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => {});
  }
}

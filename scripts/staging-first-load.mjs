// PRIMEIRA CARGA do banco de staging. Rodada só pelo Diego, por scripts/staging-first-load.sh
// (que entrega a área de transferência por stdin). Não rode este arquivo direto.
//
// O que faz, nesta ordem:
//   1. lê o snippet do Vercel do stdin (só em memória; nada vai para disco, argumento ou log);
//   2. valida o destino: projeto de staging, pooler de sessão (5432), nunca produção;
//   3. exige o schema public VAZIO;
//   4. aplica os supabase/schema*.sql na ordem de supabase/ci-order.txt (1 passada, para no 1º erro);
//   5. semeia os dados de teste de scripts/lib/test-seed.mjs (barbearias, distribuidores e usuários
//      @example.test); os usuários são criados pela Admin API, com senha gerada na hora;
//   6. grava as credenciais de TESTE (não a senha do banco) em .staging-test-users.json (0600, fora do git);
//   7. imprime um resumo sem segredos.
// Não tem drop, truncate, delete, update nem reset em lugar nenhum.
//
// Opções: --so-dados-de-teste (pula 3 e 4; para repetir só o passo 5 se ele falhou)
//         --local             (Supabase LOCAL em 127.0.0.1, só para teste do próprio script)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { loadManifest, connect, assertEmptyPublic, applyAll, GuardError } from "./lib/schema-apply.mjs";
import { targetsFromSnippet, STAGING_PROJECT_REF } from "./lib/first-load.mjs";
import { runSeed, TENANTS, USERS } from "./lib/test-seed.mjs";

const args = process.argv.slice(2);
const unknown = args.filter((a) => !["--local", "--so-dados-de-teste"].includes(a));
const local = args.includes("--local");
const onlySeed = args.includes("--so-dados-de-teste");
const credsFile = path.resolve(local ? ".staging-test-users.local.json" : ".staging-test-users.json");

async function readStdin() {
  if (process.stdin.isTTY) throw new GuardError("Rode pelo comando: bash scripts/staging-first-load.sh");
  const chunks = [];
  let size = 0;
  for await (const c of process.stdin) {
    size += c.length;
    if (size > 256 * 1024) throw new GuardError("Conteúdo grande demais para ser o snippet do Vercel.");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Cria o usuário pela Admin API. Devolve o id, ou null se o e-mail já existia. */
async function createUser({ apiUrl, serviceKey }, email, password) {
  let res;
  try {
    res = await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
  } catch {
    throw new GuardError(`Admin API fora do ar ou sem rede ao criar ${email}.`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.id) return body.id;
  if (res.status === 422 && /exist|registered/i.test(`${body.error_code ?? ""} ${body.msg ?? ""}`)) return null;
  throw new GuardError(`Admin API recusou ${email}: HTTP ${res.status} ${body.error_code ?? ""}`.trim());
}

/** Semeia e grava as senhas dos usuários criados nesta rodada (mesmo se parar no meio). */
async function seed(client, api) {
  const fresh = [];
  const existing = [];
  const ensureUser = async (email) => {
    const password = randomBytes(18).toString("base64url");
    const id = await createUser(api, email, password);
    const u = USERS.find((x) => x.email === email);
    if (id) {
      fresh.push({ email, papel: u.role, barbearia: TENANTS[u.tenant].subdomain, entra_em: u.entra, password });
      return id;
    }
    const { rows } = await client.query("select id from auth.users where email = $1", [email]);
    if (!rows[0]) throw new GuardError(`A Admin API diz que ${email} já existe, mas não o achei no banco.`);
    existing.push(email);
    return rows[0].id;
  };
  try {
    await runSeed({ q: async (sql, params) => (await client.query(sql, params)).rows, ensureUser });
  } finally {
    if (fresh.length) {
      fs.writeFileSync(credsFile, JSON.stringify({ gerado_em: new Date().toISOString(), usuarios: fresh }, null, 2) + "\n", { mode: 0o600 });
      fs.chmodSync(credsFile, 0o600);
    }
  }
  return { fresh: fresh.map((f) => f.email), existing };
}

async function main() {
  if (unknown.length) throw new GuardError("Opção desconhecida. Este comando não recebe URL nem senha como argumento.");
  const caPath = process.env.SUPABASE_CA_CERT || path.join(os.homedir(), "Downloads", "prod-ca-2021.crt");
  if (!local && !fs.existsSync(caPath))
    throw new GuardError(
      `Faltou o certificado do Supabase em ${caPath}.\n` +
        "Baixe em: painel do Supabase (projeto de staging) → Project Settings → Database → SSL Configuration → " +
        "Download certificate. Deixe em ~/Downloads (ou aponte com SUPABASE_CA_CERT) e rode de novo."
    );

  const t = targetsFromSnippet(await readStdin(), { local, caPath });
  const where = local ? "Supabase LOCAL (teste)" : `staging (${STAGING_PROJECT_REF})`;
  console.log(`Destino: ${where}, ${t.db.host}:${t.db.port}, lido de ${t.dbFrom}${t.dbDerived ? " (porta trocada para 5432)" : ""}.`);

  let client;
  let applied = 0;
  try {
    client = await connect(t.db);
    if (onlySeed) {
      const { rows } = await client.query("select to_regclass('public.tenants') is not null as ok");
      if (!rows[0].ok) throw new GuardError("--so-dados-de-teste: o schema ainda não foi aplicado neste banco.");
    } else {
      const manifest = loadManifest();
      await assertEmptyPublic(client);
      console.log(`Aplicando ${manifest.files.length} arquivos na ordem de supabase/ci-order.txt:`);
      await applyAll(client, manifest);
      applied = manifest.files.length;
    }
    let users;
    try {
      users = await seed(client, t);
    } catch (e) {
      const msg = e instanceof GuardError ? e.message : String(e?.message ?? e).split("\n")[0];
      throw new GuardError(
        `Dados de teste: ${msg}\n` +
          (onlySeed ? "" : "O schema JÁ ESTÁ aplicado. ") +
          "Para repetir só os dados de teste: copie o snippet de novo e rode\n  bash scripts/staging-first-load.sh --so-dados-de-teste"
      );
    }
    const { rows } = await client.query("select count(*)::int as n from pg_tables where schemaname = 'public'");
    console.log("\nResumo (sem segredos):");
    console.log(`  schema: ${onlySeed ? "não aplicado nesta rodada (--so-dados-de-teste)" : `${applied} arquivos aplicados`}; ${rows[0].n} tabelas em public`);
    console.log(`  barbearias e distribuidores de teste: ${Object.values(TENANTS).map((x) => x.subdomain).join(", ")}`);
    for (const u of USERS)
      console.log(`  usuário: ${u.email} (${u.role}, ${TENANTS[u.tenant].subdomain})${users.existing.includes(u.email) ? " já existia, senha não alterada" : ""}`);
    if (users.fresh.length) console.log(`  senhas de teste: ${credsFile} (permissão 600, fora do git)`);
  } finally {
    await client?.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof GuardError ? e.message : `Erro inesperado: ${String(e?.message ?? e).split("\n")[0]}`}`);
  process.exitCode = 1;
});

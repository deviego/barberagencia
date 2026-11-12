// PRIMEIRA CARGA do banco de staging. Rodada só pelo Diego, por scripts/staging-first-load.sh
// (que entrega a área de transferência por stdin). Não rode este arquivo direto.
//
// O que faz, nesta ordem:
//   1. lê o snippet do Vercel do stdin (só em memória; nada vai para disco, argumento ou log);
//   2. valida o destino: projeto de staging, pooler de sessão (5432), nunca produção;
//   3. exige o schema public VAZIO;
//   4. aplica os supabase/schema*.sql na ordem de supabase/ci-order.txt (1 passada, para no 1º erro);
//   5. cria 2 barbearias-base de teste e 3 usuários @example.test pela Admin API, com senha gerada na hora;
//   6. grava as credenciais de TESTE (não a senha do banco) em .staging-test-users.json (0600, fora do git);
//   7. imprime um resumo sem segredos.
// Não tem drop, truncate, delete nem reset em lugar nenhum.
//
// Opções: --so-usuarios (pula 3 e 4; para repetir só o passo 5 se ele falhou)
//         --local       (Supabase LOCAL em 127.0.0.1, só para teste do próprio script)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { loadManifest, connect, assertEmptyPublic, applyAll, GuardError } from "./lib/schema-apply.mjs";
import { targetsFromSnippet, STAGING_PROJECT_REF } from "./lib/first-load.mjs";

const TENANTS = [
  { key: "plataforma", name: "Plataforma Teste", subdomain: "teste-plataforma", saas_plan: "advance" },
  { key: "barbearia", name: "Barbearia Teste", subdomain: "teste-barbearia", saas_plan: "advance" },
];
const USERS = [
  { email: "master@example.test", full_name: "Master Teste", tenant: "plataforma", role: "MASTER" },
  { email: "dono@example.test", full_name: "Dono Teste", tenant: "barbearia", role: "UNIT_ADMIN" },
  // CLIENT: o gatilho handle_new_user cria o cliente e o vínculo a partir do tenant_subdomain.
  { email: "cliente@example.test", full_name: "Cliente Teste", tenant: "barbearia", role: "CLIENT" },
];

const args = process.argv.slice(2);
const unknown = args.filter((a) => !["--local", "--so-usuarios"].includes(a));
const local = args.includes("--local");
const onlyUsers = args.includes("--so-usuarios");
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

async function createUser({ apiUrl, serviceKey }, u, password) {
  let res;
  try {
    res = await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, ...(u.role === "CLIENT" ? { tenant_subdomain: u.subdomain } : {}) },
      }),
    });
  } catch {
    throw new GuardError(`Admin API fora do ar ou sem rede ao criar ${u.email}.`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.id) return { id: body.id, created: true };
  if (res.status === 422 && /exist|registered/i.test(`${body.error_code ?? ""} ${body.msg ?? ""}`)) return { created: false };
  throw new GuardError(`Admin API recusou ${u.email}: HTTP ${res.status} ${body.error_code ?? ""}`.trim());
}

async function seed(client, api) {
  const tenantId = {};
  for (const t of TENANTS) {
    await client.query(
      `insert into public.tenants (name, subdomain, saas_plan)
       select $1, $2, $3 where not exists (select 1 from public.tenants where subdomain = $2)`,
      [t.name, t.subdomain, t.saas_plan]
    );
    const { rows } = await client.query("select id from public.tenants where subdomain = $1", [t.subdomain]);
    tenantId[t.key] = rows[0].id;
  }
  const done = [];
  try {
    for (const u of USERS) {
      const password = randomBytes(18).toString("base64url");
      const subdomain = TENANTS.find((t) => t.key === u.tenant).subdomain;
      const r = await createUser(api, { ...u, subdomain }, password);
      if (r.created && u.role !== "CLIENT") {
        await client.query(
          "insert into public.memberships (user_id, tenant_id, role) values ($1, $2, $3) on conflict do nothing",
          [r.id, tenantId[u.tenant], u.role]
        );
      }
      done.push({ email: u.email, role: u.role, barbearia: subdomain, ...(r.created ? { password } : { ja_existia: true }) });
    }
  } finally {
    const fresh = done.filter((d) => d.password);
    if (fresh.length) {
      fs.writeFileSync(credsFile, JSON.stringify({ gerado_em: new Date().toISOString(), usuarios: fresh }, null, 2) + "\n", { mode: 0o600 });
      fs.chmodSync(credsFile, 0o600);
    }
  }
  return done;
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
    if (onlyUsers) {
      const { rows } = await client.query("select to_regclass('public.tenants') is not null as ok");
      if (!rows[0].ok) throw new GuardError("--so-usuarios: o schema ainda não foi aplicado neste banco.");
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
      throw new GuardError(
        `${e?.message ?? e}\nO schema JÁ ESTÁ aplicado. Para repetir só os usuários: copie o snippet de novo e rode ` +
          "bash scripts/staging-first-load.sh --so-usuarios"
      );
    }
    const { rows } = await client.query("select count(*)::int as n from pg_tables where schemaname = 'public'");
    console.log("\nResumo (sem segredos):");
    console.log(`  schema: ${onlyUsers ? "não aplicado nesta rodada (--so-usuarios)" : `${applied} arquivos aplicados`}; ${rows[0].n} tabelas em public`);
    console.log(`  barbearias de teste: ${TENANTS.map((x) => x.subdomain).join(", ")}`);
    for (const u of users) console.log(`  usuário: ${u.email} (${u.role})${u.ja_existia ? " já existia, senha não alterada" : ""}`);
    if (users.some((u) => u.password)) console.log(`  senhas de teste: ${credsFile} (permissão 600, fora do git)`);
  } finally {
    await client?.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof GuardError ? e.message : `Erro inesperado: ${String(e?.message ?? e).split("\n")[0]}`}`);
  process.exitCode = 1;
});

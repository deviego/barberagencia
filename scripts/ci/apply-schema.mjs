// CI: aplica supabase/schema*.sql num Supabase LOCAL (docker, `supabase start`) com a MESMA
// ordem e as 2 passadas do scripts/bootstrap-staging.mjs. Só aceita localhost.
//
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/ci/apply-schema.mjs
// Saída: lista de arquivos adiados/falhos com o erro; exit 1 se algo falhar na 2ª passada.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "::1", "db", "postgres"].includes(host)) {
  console.error(`ABORTADO: ${host} não é local. Este script só roda contra o Supabase do docker.`);
  process.exit(1);
}

const dir = path.resolve("supabase");
const files = fs.readdirSync(dir).filter((f) => f.startsWith("schema") && f.endsWith(".sql"));
// Mesma ordem do bootstrap-staging: schema.sql → nomeados → numéricos crescentes.
const rank = (f) => {
  if (f === "schema.sql") return -1;
  const m = f.match(/^schema-(\d+)/);
  return m ? 100 + Number(m[1]) : 10;
};
files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

// MODO MANIFESTO (recomendado pelo spike): ordem cronológica explícita em supabase/ci-order.txt,
// UMA passada, qualquer erro falha. As 2 passadas escondem erro de ordem e reaplicam arquivos
// fora de ordem (ver docs/spikes/2026-11-ci-supabase-efemero.md).
const manifest = process.env.SCHEMA_ORDER_FILE;
if (manifest) {
  const listed = fs.readFileSync(manifest, "utf8").split(/\s+/).filter(Boolean);
  const missing = files.filter((f) => !listed.includes(f));
  if (missing.length) {
    console.error(`✗ Arquivos fora do manifesto ${manifest}: ${missing.join(", ")}`);
    process.exit(1);
  }
  files.splice(0, files.length, ...listed);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

async function applyOnce(list, label) {
  const failed = [];
  for (const f of list) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const t = Date.now();
    try {
      // Cada arquivo numa transação: se falhar, não deixa metade aplicada.
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log(`  ✓ ${f} (${Date.now() - t}ms)`);
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.log(`  ✗ [${label}] ${f}: ${e.message.split("\n")[0]}`);
      failed.push(f);
    }
  }
  return failed;
}

try {
  const t0 = Date.now();
  console.log(`Passada 1/2 — ${files.length} arquivos:`);
  const failed1 = await applyOnce(files, "p1");
  let failed2 = [];
  if (failed1.length && !manifest) {
    console.log(`\nPassada 2/2 — ${failed1.length} adiados:`);
    failed2 = await applyOnce(failed1, "p2");
  }
  console.log(`\nResumo: ${files.length} arquivos, adiados na 1ª: ${failed1.length}, falhos na 2ª: ${failed2.length}, ${Date.now() - t0}ms`);
  const failedFinal = manifest ? failed1 : failed2;
  if (failedFinal.length) {
    console.error(`✗ Falharam: ${failedFinal.join(", ")}`);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}

// Bootstrap de um banco Supabase NOVO (staging) com o schema de produção.
// Aplica todos os supabase/schema*.sql — idempotentes — em 2 passadas, para
// resolver dependências de ordem entre os arquivos. NÃO aplica seeds.
//
// Uso:
//   STAGING_DATABASE_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres" \
//   node scripts/bootstrap-staging.mjs
// ou:  node scripts/bootstrap-staging.mjs "postgresql://...."
//
// Dica: use a conexão DIRETA (porta 5432), não a pooled (6543).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.STAGING_DATABASE_URL || process.argv[2];
if (!url) {
  console.error("Faltou a URL do banco de staging (STAGING_DATABASE_URL ou 1º argumento).");
  process.exit(1);
}
if (/aws-0-ca-central-1|tusfxbnnrypjtzqcvpov/.test(url)) {
  console.error("ABORTADO: essa URL parece ser a de PRODUÇÃO. Use o banco de STAGING.");
  process.exit(1);
}

const dir = path.resolve("supabase");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("schema") && f.endsWith(".sql"));

// Ordem: schema.sql → nomeados (tenant/unit/wa/...) → numéricos crescentes.
const rank = (f) => {
  if (f === "schema.sql") return -1;
  const m = f.match(/^schema-(\d+)/);
  if (m) return 100 + Number(m[1]);
  return 10; // nomeados foundacionais (schema-tenant.sql, schema-unit.sql, etc.)
};
files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

async function applyOnce(list) {
  const failed = [];
  for (const f of list) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    try {
      await client.query(sql);
      console.log(`  ✓ ${f}`);
    } catch (e) {
      console.log(`  … ${f} adiado (${e.message.split("\n")[0]})`);
      failed.push(f);
    }
  }
  return failed;
}

try {
  console.log(`Passada 1/2 — ${files.length} arquivos:`);
  const failed1 = await applyOnce(files);
  if (failed1.length) {
    console.log(`\nPassada 2/2 — reaplicando ${failed1.length} adiados:`);
    const failed2 = await applyOnce(failed1);
    if (failed2.length) {
      console.error(`\n✗ Falharam mesmo na 2ª passada: ${failed2.join(", ")}`);
      console.error("Rode de novo ou aplique esses manualmente com dbadmin apontando ao staging.");
      process.exitCode = 1;
    } else {
      console.log("\n✓ Tudo aplicado (2ª passada resolveu as dependências).");
    }
  } else {
    console.log("\n✓ Tudo aplicado na 1ª passada.");
  }
} finally {
  await client.end();
}

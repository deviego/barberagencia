// Bootstrap de um banco Supabase NOVO (staging) com o schema de produção.
// Aplica os supabase/schema*.sql na ordem de supabase/ci-order.txt (ordem cronológica em que
// foram criados), em UMA passada, cada arquivo numa transação, e PARA no primeiro erro.
// NUNCA aplica seeds.
//
// Por que não mais "2 passadas em ordem alfabética": esse jeito aplicava sem erro, mas gerava um
// banco diferente da produção (auth_tenant_id sem o "Atuar como" do MASTER e `authenticated` sem
// EXECUTE em blocked_ranges/place_order/set_order_status). Ver docs/spikes/2026-11-ci-supabase-efemero.md.
//
// Uso:
//   STAGING_DATABASE_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres" \
//   node scripts/bootstrap-staging.mjs
// ou:  node scripts/bootstrap-staging.mjs "postgresql://...."
//
// Dica: use a conexão DIRETA (porta 5432), não a pooled (6543). O banco precisa estar VAZIO.
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
const manifestPath = path.join(dir, "ci-order.txt");
const order = fs.readFileSync(manifestPath, "utf8").split(/\s+/).filter(Boolean);

// O manifesto precisa bater exatamente com os arquivos schema*.sql: nada faltando, nada a mais.
const onDisk = fs.readdirSync(dir).filter((f) => f.startsWith("schema") && f.endsWith(".sql"));
const notListed = onDisk.filter((f) => !order.includes(f));
const notFound = order.filter((f) => !onDisk.includes(f));
const notSchema = order.filter((f) => !/^schema[\w-]*\.sql$/.test(f)); // nunca seed*.sql
const dupes = order.filter((f, i) => order.indexOf(f) !== i);
if (notListed.length || notFound.length || notSchema.length || dupes.length) {
  if (notListed.length) console.error(`✗ Fora do ci-order.txt: ${notListed.join(", ")} (adicione na posição certa)`);
  if (notFound.length) console.error(`✗ No ci-order.txt mas não existe: ${notFound.join(", ")}`);
  if (notSchema.length) console.error(`✗ Só schema*.sql pode entrar (seeds nunca): ${notSchema.join(", ")}`);
  if (dupes.length) console.error(`✗ Repetidos no ci-order.txt: ${dupes.join(", ")}`);
  process.exit(1);
}

const host = new URL(url).hostname;
const local = ["127.0.0.1", "localhost", "::1"].includes(host);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();

try {
  console.log(`Aplicando ${order.length} arquivos na ordem de supabase/ci-order.txt (1 passada):`);
  for (const [i, f] of order.entries()) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log(`  ✓ ${String(i + 1).padStart(2)} ${f}`);
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error(`\n✗ PAROU em ${f} (${i + 1}/${order.length}): ${e.message.split("\n")[0]}`);
      console.error("Nada depois dele foi aplicado. O banco precisa estar vazio; corrija e recrie o staging.");
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log(`\n✓ ${order.length} arquivos aplicados.`);
} finally {
  await client.end();
}

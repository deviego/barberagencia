// Bootstrap de um banco Supabase NOVO e VAZIO (staging) com o schema de produção.
// Aplica os supabase/schema*.sql na ordem de supabase/ci-order.txt, 1 passada, cada arquivo numa
// transação, para no 1º erro. NUNCA aplica seeds. Toda a lógica e as guardas ficam em
// scripts/lib/schema-apply.mjs (o mesmo módulo do CI).
//
// Uso — SÓ por variáveis de ambiente (argumento na linha de comando vaza no `ps` e no histórico):
//   export STAGING_PROJECT_REF="<ref do projeto de staging>"
//   export SUPABASE_CA_CERT="$HOME/Downloads/prod-ca-2021.crt"
//   read -s -p "Senha do Postgres: " PGPASS_STAGING; echo     # sem eco e fora do histórico do shell
//   export STAGING_DATABASE_URL="postgresql://postgres.<ref>:${PGPASS_STAGING}@aws-N-<região>.pooler.supabase.com:5432/postgres"
//   node scripts/bootstrap-staging.mjs
//   unset PGPASS_STAGING STAGING_DATABASE_URL
// Nunca escreva a senha na linha do export: ela ficaria no histórico do shell.
//
// Guardas: allowlist pela STAGING_PROJECT_REF, ref de produção recusada, ?host=/?hostaddr= recusados,
// SSL verificado com a CA do Supabase, e aborta se o schema public já tiver qualquer tabela.
import { run, stagingTarget, GuardError } from "./lib/schema-apply.mjs";

if (process.argv.length > 2) {
  console.error("✗ Não passe a URL como argumento (vaza no ps/histórico). Use STAGING_DATABASE_URL.");
  process.exit(1);
}

let config;
try {
  config = stagingTarget({
    url: process.env.STAGING_DATABASE_URL,
    projectRef: process.env.STAGING_PROJECT_REF,
    caPath: process.env.SUPABASE_CA_CERT,
  });
} catch (e) {
  console.error(`✗ ${e instanceof GuardError ? e.message : "URL inválida."}`);
  process.exit(1);
}
await run(config, { label: "Staging" });

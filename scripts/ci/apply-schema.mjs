// CI / prova local: aplica os supabase/schema*.sql num Supabase LOCAL (docker, `supabase start`),
// SEMPRE na ordem de supabase/ci-order.txt, 1 passada, cada arquivo numa transação, para no 1º erro.
// Mesmo módulo e mesmas validações do bootstrap de staging (scripts/lib/schema-apply.mjs):
// manifesto exato (sem arquivo fora da lista, inexistente, repetido ou seed), só loopback,
// ?host=/?hostaddr= recusados, e aborta se o schema public já tiver qualquer tabela.
//
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/ci/apply-schema.mjs
// (sem DATABASE_URL, usa essa URL local padrão do `supabase start`). Exit 1 em qualquer falha.
import { run, localTarget, GuardError } from "../lib/schema-apply.mjs";

let config;
try {
  config = localTarget(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
} catch (e) {
  console.error(`✗ ${e instanceof GuardError ? e.message : "URL inválida."}`);
  process.exit(1);
}
await run(config, { label: "Local" });

// Testes de privacidade da fila rápida (#100), sem rede e sem banco. Conferem no código que:
// a jornada sem login nunca lê plano/dados da conta, não existe entrada "pelo plano", a área da
// conta exige login, a credencial do aparelho não sai do caminho da fila, as mensagens não
// levam dado pessoal e a ficha da fila rápida fica fora do marketing.
// Roda com: node scripts/test-quick-queue-privacy.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const MOD = path.join(SRC, "features/quick-queue");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FALHOU - ${name}`);
    throw e;
  }
}

/** Corpo de uma função SQL (do "create or replace function public.<nome>(" até o "$$;"). */
function sqlFunction(file, name) {
  const src = read(file);
  const i = src.lastIndexOf(`create or replace function public.${name}(`);
  assert.ok(i >= 0, `${name} em ${file}`);
  return src.slice(i, src.indexOf("$$;", i));
}

const ACCOUNT_TABLES = /client_subscriptions|combo_plans|appointments|payments|saldo_cortes|birth|email/;

await test("identificação por telefone (banco) não lê plano nem dado da conta", () => {
  const body = sqlFunction("supabase/schema-52-quick-queue-clients.sql", "quick_queue_identify");
  assert.doesNotMatch(body, ACCOUNT_TABLES);
  // Responde só o código do resultado e se a credencial é nova.
  assert.match(sqlFunction("supabase/schema-52-quick-queue-clients.sql", "quick_queue_identify"), /returns table \(result text, new_device boolean\)/i);
});

await test("entrar na fila (banco) não aceita plano e não mexe em saldo ou reserva", () => {
  const body = sqlFunction("supabase/schema-54-quick-queue-limits.sql", "quick_queue_join");
  assert.doesNotMatch(body, /client_subscriptions|saldo_cortes|consume_cut|consumed_from_plan|combo_plan/);
  assert.doesNotMatch(body.slice(0, body.indexOf(")")), /plan/i, "nenhum parâmetro de plano");
});

await test("ações e leituras da jornada sem login não leem plano nem dado da conta", () => {
  for (const f of readdirSync(MOD).filter((f) => f.endsWith(".ts"))) {
    if (f === "admin-data.ts" || f === "admin-actions.ts") continue; // painel do dono, com login
    const src = readFileSync(path.join(MOD, f), "utf8");
    assert.doesNotMatch(src, /client_subscriptions|combo_plans|consume_cut|saldo_cortes|from\("appointments"\)|from\("payments"\)/, f);
    assert.doesNotMatch(src, /select\([^)]*\b(email|birth|birthday|nascimento)\b/, f);
  }
});

await test("pedido de entrar na fila não tem campo de plano (o que vier a mais é descartado)", async () => {
  const schema = readFileSync(path.join(MOD, "schema.ts"), "utf8");
  const join = schema.slice(schema.indexOf("JoinQuickQueueInputSchema"));
  assert.doesNotMatch(join.slice(0, join.indexOf("});")), /plan/i);
  assert.doesNotMatch(join.slice(0, join.indexOf("});")), /\.passthrough\(|\.catchall\(/);
  const types = readFileSync(path.join(MOD, "types.ts"), "utf8");
  const input = types.slice(types.indexOf("export type JoinQuickQueueInput"));
  assert.doesNotMatch(input.slice(0, input.indexOf("};")), /plan/i);
});

await test("respostas da identificação: telefone conhecido com e sem plano têm o mesmo formato", () => {
  // O banco responde KNOWN para os dois (não lê plano); a ação traduz KNOWN sempre do mesmo jeito.
  const actions = readFileSync(path.join(MOD, "actions.ts"), "utf8");
  const known = [...actions.matchAll(/case "KNOWN":[\s\S]*?return ([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(known.length >= 1);
  for (const r of known) assert.match(r, /^\{ ok: true, next: "SERVICE" \}$/);
});

await test("área da conta do cliente exige login antes de qualquer leitura", () => {
  const layout = read("src/app/client/(app)/layout.tsx");
  const guard = layout.indexOf('if (!user) redirect("/client/login")');
  assert.ok(guard > 0, "layout redireciona sem sessão");
  assert.ok(guard < layout.indexOf("getActivePlanBalance()"), "plano só é lido depois da sessão");
});

await test("credencial do aparelho só vale no caminho da fila e ninguém fora da fila rápida a lê", () => {
  const device = readFileSync(path.join(MOD, "device.ts"), "utf8");
  assert.match(device, /return `\/b\/\$\{slug\}\/fila`;/);
  assert.match(device, /httpOnly: true/);
  for (const f of walk(SRC)) {
    if (f.startsWith(MOD) || f.includes(`${path.sep}b${path.sep}[slug]${path.sep}fila`)) continue;
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /bb_qq|readDeviceToken|QUICK_QUEUE_DEVICE_COOKIE|quick_queue_devices/, path.relative(ROOT, f));
  }
});

await test("textos da jornada não levam dado pessoal (só número de senha e contagem)", async () => {
  const types = readFileSync(path.join(MOD, "types.ts"), "utf8");
  const placeholders = [...types.matchAll(/"[^"]*(\{[a-z]+\})[^"]*"/g)].map((m) => m[1]);
  for (const p of placeholders) assert.ok(["{senha}", "{n}"].includes(p), `placeholder ${p}`);
});

await test("logs da jornada não levam telefone, nome nem credencial", () => {
  for (const f of readdirSync(MOD).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(path.join(MOD, f), "utf8");
    for (const m of src.matchAll(/console\.(error|warn|log|info)\(([^;]*)\);/g)) {
      assert.doesNotMatch(m[2], /phone|name|token|hash|key\b|clientId|client_id/i, `${f}: ${m[0]}`);
    }
  }
});

await test("marketing: ficha da fila rápida fica de fora; as outras seguem", async () => {
  const { canReceiveMarketing } = await import("../src/lib/marketing-consent.ts");
  assert.equal(canReceiveMarketing({ signup_origin: "QUICK_QUEUE" }), false);
  assert.equal(canReceiveMarketing({ signup_origin: null }), true);
  // #148: campo ausente (não lido) = não pode.
  assert.equal(canReceiveMarketing({}), false);
  assert.equal(canReceiveMarketing(undefined), false);
  const src = readFileSync(path.join(SRC, "lib/marketing-consent.ts"), "utf8");
  assert.match(src, /signup_origin: string \| null;/, "campo obrigatório no tipo");
  assert.doesNotMatch(src, /signup_origin\?:/);
});

console.log(`\n${passed} testes ok`);

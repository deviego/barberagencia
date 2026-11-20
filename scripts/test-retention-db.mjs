// Testes de banco da retenção dos registros técnicos (#108): schema-60 + purge_technical_records.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Cada execução cria uma barbearia nova com sufixo aleatório. A única remoção é a da própria
// função testada, que só alcança registros técnicos com mais de 7 dias.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-retention-db.mjs
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { localTarget } from "./lib/schema-apply.mjs";

const require = createRequire(import.meta.url);
const pg = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("✗ Defina DATABASE_URL (Supabase local).");
  process.exit(1);
}
const config = localTarget(process.env.DATABASE_URL); // recusa qualquer host que não seja loopback
const pool = new pg.Pool({ ...config, max: 5 });

const RUN = randomBytes(3).toString("hex");
const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
const MIGRATION = new URL("../supabase/schema-60-retencao-registros-tecnicos.sql", import.meta.url);

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

/** Roda a função como o papel pedido (o wa-gateway chama como service_role). */
async function purgeAs(role) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    const { rows } = await c.query("select * from public.purge_technical_records()");
    await c.query("commit");
    return rows[0];
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

const count = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);

// ---- Cenário ---------------------------------------------------------------------------------
// Antes de montar: zera o que já estiver vencido no banco (de execuções anteriores), para que as
// contagens abaixo sejam exatamente as deste cenário.
await purgeAs("service_role");

const { rows: t } = await pool.query(
  `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
   values ($1, $2, 'essencial', 'BARBERSHOP', true, true) returning id`,
  [`Barbearia Retencao ${RUN}`, `ret-${RUN}`]
);
const tenant = t[0].id;
const { rows: cl } = await pool.query(
  `insert into public.clients (tenant_id, name, phone, email, created_at)
   values ($1, 'Cliente Antigo Teste', '11987650001', $2, now() - interval '400 days') returning id`,
  [tenant, `ret-${RUN}@example.test`]
);
const client = cl[0].id;

const SCOPE = `ret-${RUN}`;
const ages = { old: "7 days 1 minute", recent: "6 days 23 hours" };
for (const [label, age] of Object.entries(ages)) {
  await pool.query(
    `insert into public.rate_limit_events (scope, key, created_at) values ($1, $2, now() - $3::interval)`,
    [SCOPE, `${label}-${hash().slice(0, 16)}`, age]
  );
}

async function device(over) {
  const { rows } = await pool.query(
    `insert into public.quick_queue_devices
       (tenant_id, token_hash, client_id, pending_phone_key, pending_until, created_at, last_used_at, expires_at)
     values ($1, $2, $3, $4, $5, now() - interval '20 days', now() - interval '20 days', $6)
     returning *`,
    [tenant, hash(), over.client ?? null, over.pendingKey ?? null, over.pendingUntil ?? null, over.expiresAt]
  );
  return rows[0];
}
const past = (sql) => pool.query(`select now() - $1::interval as v`, [sql]).then((r) => r.rows[0].v);
const future = (sql) => pool.query(`select now() + $1::interval as v`, [sql]).then((r) => r.rows[0].v);

const devPendingExpired = await device({ pendingKey: "11987650002", pendingUntil: await past("1 minute"), expiresAt: await future("10 days") });
const devPendingFuture = await device({ pendingKey: "11987650003", pendingUntil: await future("5 minutes"), expiresAt: await future("10 days") });
const devExpiredCredential = await device({ client, expiresAt: await past("60 days") }); // fora do escopo: fica
const devBound = await device({ client, expiresAt: await future("10 days") });

for (const [age, dev] of [
  [ages.old, devBound.id],
  [ages.recent, devBound.id],
  [ages.old, null],
]) {
  await pool.query(
    `insert into public.quick_queue_identify_attempts (tenant_id, device_id, client_id, created_at)
     values ($1, $2, $3, now() - $4::interval)`,
    [tenant, dev, client, age]
  );
}

const businessTables = ["tenants", "clients", "queue_entries", "appointments", "services", "barbers", "quick_queue_devices"];
const before = {};
for (const tb of businessTables) before[tb] = await count(`select count(*) n from public.${tb}`);

// ---- Testes ----------------------------------------------------------------------------------
await test("anon não executa a função", async () => {
  await assert.rejects(purgeAs("anon"), (e) => e.code === "42501");
});

await test("authenticated não executa a função", async () => {
  await assert.rejects(purgeAs("authenticated"), (e) => e.code === "42501");
});

let result;
await test("service_role executa e recebe só as três contagens", async () => {
  result = await purgeAs("service_role");
  assert.deepEqual(Object.keys(result).sort(), [
    "identify_attempts_deleted",
    "pending_phones_cleared",
    "rate_limit_events_deleted",
  ]);
});

await test("contagens batem com o cenário (1 evento, 2 tentativas, 1 telefone pendente)", async () => {
  assert.equal(result.rate_limit_events_deleted, 1);
  assert.equal(result.identify_attempts_deleted, 2);
  assert.equal(result.pending_phones_cleared, 1);
});

await test("rate_limit_events: mais de 7 dias sai, 6 dias e 23 h fica", async () => {
  assert.equal(await count(`select count(*) n from public.rate_limit_events where scope = $1 and key like 'old-%'`, [SCOPE]), 0);
  assert.equal(await count(`select count(*) n from public.rate_limit_events where scope = $1 and key like 'recent-%'`, [SCOPE]), 1);
});

await test("identify_attempts: só a recente fica", async () => {
  const { rows } = await pool.query(
    `select created_at > now() - interval '7 days' as recent from public.quick_queue_identify_attempts where tenant_id = $1`,
    [tenant]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recent, true);
});

await test("aparelho com telefone pendente vencido: zera só os dois campos, linha fica", async () => {
  const { rows } = await pool.query(`select * from public.quick_queue_devices where id = $1`, [devPendingExpired.id]);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.pending_phone_key, null);
  assert.equal(r.pending_until, null);
  for (const col of ["tenant_id", "token_hash", "client_id"]) assert.equal(r[col], devPendingExpired[col], col);
  for (const col of ["created_at", "last_used_at", "expires_at"])
    assert.equal(r[col].getTime(), devPendingExpired[col].getTime(), col);
});

await test("aparelho com telefone pendente no prazo: nada muda", async () => {
  const { rows } = await pool.query(`select * from public.quick_queue_devices where id = $1`, [devPendingFuture.id]);
  assert.equal(rows[0].pending_phone_key, devPendingFuture.pending_phone_key);
  assert.equal(rows[0].pending_until.getTime(), devPendingFuture.pending_until.getTime());
});

await test("credencial de aparelho vencida há 60 dias continua (fora do escopo)", async () => {
  assert.equal(await count(`select count(*) n from public.quick_queue_devices where id = $1`, [devExpiredCredential.id]), 1);
});

await test("nenhuma tabela de negócio perde linha (cliente de 400 dias continua)", async () => {
  for (const tb of businessTables) assert.equal(await count(`select count(*) n from public.${tb}`), before[tb], tb);
  assert.equal(await count(`select count(*) n from public.clients where id = $1`, [client]), 1);
});

await test("segunda execução seguida não acha mais nada", async () => {
  const again = await purgeAs("service_role");
  assert.deepEqual(again, { rate_limit_events_deleted: 0, identify_attempts_deleted: 0, pending_phones_cleared: 0 });
});

await test("migration re-executável (aplicar de novo não falha e mantém as permissões)", async () => {
  await pool.query(readFileSync(MIGRATION, "utf8"));
  await assert.rejects(purgeAs("anon"), (e) => e.code === "42501");
  await purgeAs("service_role");
});

await test("função é security definer, search_path fixo e sem parâmetro de prazo", async () => {
  const { rows } = await pool.query(
    `select p.prosecdef, p.pronargs, p.proconfig from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'purge_technical_records'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].prosecdef, true);
  assert.equal(rows[0].pronargs, 0);
  assert.ok(rows[0].proconfig?.some((c) => c === "search_path=public"));
});

await pool.end();
console.log(`\n${passed} testes ok`);

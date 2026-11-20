// Testes de banco da entrada na fila pela fila rápida (#97): schema-53 + quick_queue_join.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Cada execução cria barbearias novas com sufixo aleatório e não apaga nada.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-quick-queue-join-db.mjs
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
const pool = new pg.Pool({ ...config, max: 25 });

const RUN = randomBytes(3).toString("hex");
const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
const MIGRATION = new URL("../supabase/schema-53-quick-queue-join.sql", import.meta.url);

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

const one = async (sql, params = []) => (await pool.query(sql, params)).rows[0];
// Celulares fictícios distintos dentro da execução (base aleatória + sequência).
let phoneSeq = 0;
const PHONE_BASE = 10_000_000 + Math.floor(Math.random() * 80_000_000);
const fakePhone = () => `119${PHONE_BASE + ++phoneSeq}`;

async function shop(label, { quick = true, queue = true, pick = false } = {}) {
  const { id } = await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
     values ($1, $2, 'essencial', 'BARBERSHOP', $3, $4) returning id`,
    [`Barbearia ${label} Teste`, `qj-${label}-${RUN}`, queue, quick]
  );
  await pool.query(
    `insert into public.tenant_settings (tenant_id, queue_pick_barber) values ($1, $2)
     on conflict (tenant_id) do update set queue_pick_barber = excluded.queue_pick_barber`,
    [id, pick]
  );
  return id;
}
const service = async (tenant, { price = "35.00", active = true } = {}) =>
  (
    await one(
      `insert into public.services (tenant_id, name, duration_min, price_brl, active)
       values ($1, 'Corte Teste', 30, $2, $3) returning id`,
      [tenant, price, active]
    )
  ).id;
const barber = async (tenant, { active = true, queue = true } = {}) =>
  (
    await one(
      `insert into public.barbers (tenant_id, name, active, accepts_queue) values ($1, 'Barbeiro Teste', $2, $3) returning id`,
      [tenant, active, queue]
    )
  ).id;
const client = async (tenant) =>
  (
    await one(
      `insert into public.clients (tenant_id, name, phone, email) values ($1, 'Cliente Teste', $2, $3) returning id`,
      [tenant, fakePhone(), `qj-${RUN}-${randomBytes(3).toString("hex")}@example.test`]
    )
  ).id;
/** Credencial já ligada a um cliente (o que o passo do telefone da #96 deixa). */
async function device(tenant, { clientId, expires = "30 days" } = {}) {
  const h = hash();
  const cid = clientId === undefined ? await client(tenant) : clientId;
  const { id } = await one(
    `insert into public.quick_queue_devices (tenant_id, token_hash, client_id, expires_at)
     values ($1, $2, $3, now() + $4::interval) returning id`,
    [tenant, h, cid, expires]
  );
  return { hash: h, id, clientId: cid };
}

async function join(tenant, dev, svc, cents = 3500, barberId = null, c = pool) {
  const { rows } = await c.query(`select public.quick_queue_join($1, $2, $3, $4, $5) as r`, [
    tenant,
    typeof dev === "string" ? dev : dev.hash,
    svc,
    cents,
    barberId,
  ]);
  return rows[0].r;
}
const entries = (tenant) =>
  pool.query(`select * from public.queue_entries where tenant_id = $1 order by ticket_number`, [tenant]).then((r) => r.rows);

async function asRole(role, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    const r = await fn(c);
    await c.query("rollback");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

// ---- Cenário base ------------------------------------------------------------------------------
const A = await shop("a");
const B = await shop("b");
const svcA = await service(A);
const svcB = await service(B);

// ---- Testes ------------------------------------------------------------------------------------
await test("cria a senha 1 com origem fila rápida, telefone não verificado e o aparelho", async () => {
  const dev = await device(A);
  assert.equal(await join(A, dev, svcA), "OK");
  const [e] = await entries(A);
  assert.equal(e.ticket_number, 1);
  assert.equal(e.client_id, dev.clientId);
  assert.equal(e.service_id, svcA);
  assert.equal(e.barber_id, null);
  assert.equal(e.status, "WAITING");
  assert.equal(e.source, "QUICK_QUEUE");
  assert.equal(e.phone_verified, false);
  assert.equal(e.device_id, dev.id);
});

await test("cliente com senha ativa hoje: EXISTING e nada muda", async () => {
  const dev = await device(A);
  assert.equal(await join(A, dev, svcA), "OK");
  const before = await entries(A);
  const svc2 = await service(A, { price: "50.00" });
  assert.equal(await join(A, dev, svc2, 5000), "EXISTING");
  assert.deepEqual(await entries(A), before);
});

await test("serviço de outra barbearia: SERVICE_CHANGED, nenhuma senha", async () => {
  const S = await shop("svc-outra");
  assert.equal(await join(S, await device(S), svcB), "SERVICE_CHANGED");
  assert.equal((await entries(S)).length, 0);
});

await test("serviço desativado: SERVICE_CHANGED, nenhuma senha", async () => {
  const S = await shop("svc-off");
  assert.equal(await join(S, await device(S), await service(S, { active: false })), "SERVICE_CHANGED");
  assert.equal((await entries(S)).length, 0);
});

await test("preço diferente do atual (mudou depois de abrir a tela, ou colocado à mão): SERVICE_CHANGED", async () => {
  const S = await shop("preco");
  const svc = await service(S, { price: "35.00" });
  const dev = await device(S);
  for (const cents of [3499, 3501, 0, 1]) assert.equal(await join(S, dev, svc, cents), "SERVICE_CHANGED");
  assert.equal((await entries(S)).length, 0);
  assert.equal(await join(S, dev, svc, 3500), "OK");
});

await test("barbeiro válido com escolha permitida: grava o barbeiro", async () => {
  const S = await shop("pick", { pick: true });
  const svc = await service(S);
  const b = await barber(S);
  assert.equal(await join(S, await device(S), svc, 3500, b), "OK");
  assert.equal((await entries(S))[0].barber_id, b);
});

await test("barbeiro recusado: de outra barbearia, inativo, fora da fila ou escolha desligada", async () => {
  const S = await shop("pick-neg", { pick: true });
  const svc = await service(S);
  const cases = [await barber(B), await barber(S, { active: false }), await barber(S, { queue: false })];
  for (const b of cases) assert.equal(await join(S, await device(S), svc, 3500, b), "SERVICE_CHANGED");
  const N = await shop("nopick", { pick: false });
  assert.equal(await join(N, await device(N), await service(N), 3500, await barber(N)), "SERVICE_CHANGED");
  assert.equal((await entries(S)).length + (await entries(N)).length, 0);
});

await test("sem telefone identificado: credencial desconhecida, vencida ou sem cliente → NO_CLIENT", async () => {
  const S = await shop("nocli");
  const svc = await service(S);
  assert.equal(await join(S, hash(), svc), "NO_CLIENT");
  assert.equal(await join(S, await device(S, { expires: "-1 minute" }), svc), "NO_CLIENT");
  assert.equal(await join(S, await device(S, { clientId: null }), svc), "NO_CLIENT");
  assert.equal((await entries(S)).length, 0);
});

await test("credencial de outra barbearia, ou ligada a cliente de outra barbearia → NO_CLIENT", async () => {
  const S = await shop("cross");
  const svc = await service(S);
  assert.equal(await join(S, await device(B), svc), "NO_CLIENT");
  assert.equal(await join(S, await device(S, { clientId: await client(B) }), svc), "NO_CLIENT");
  assert.equal((await entries(S)).length, 0);
});

await test("fila rápida desligada ou fila desligada → CLOSED", async () => {
  for (const opts of [{ quick: false }, { queue: false }]) {
    const S = await shop(`closed-${opts.quick === false ? "qq" : "q"}`, opts);
    assert.equal(await join(S, await device(S), await service(S)), "CLOSED");
    assert.equal((await entries(S)).length, 0);
  }
});

await test("entrada malformada → INVALID", async () => {
  const dev = await device(A);
  assert.equal(await join(A, "nao-e-hash", svcA), "INVALID");
  assert.equal(await join(A, dev, svcA, null), "INVALID");
  assert.equal(await join(null, dev, svcA), "INVALID");
});

await test("20 pedidos simultâneos de 20 aparelhos: senhas 1..20 sem repetição", async () => {
  const S = await shop("conc20");
  const svc = await service(S);
  const devs = await Promise.all(Array.from({ length: 20 }, () => device(S)));
  const res = await Promise.all(devs.map((d) => join(S, d, svc)));
  assert.deepEqual(res, Array(20).fill("OK"));
  const nums = (await entries(S)).map((e) => e.ticket_number);
  assert.deepEqual(nums, Array.from({ length: 20 }, (_, i) => i + 1));
});

await test("20 pedidos simultâneos do mesmo aparelho: uma senha só", async () => {
  const S = await shop("conc-same");
  const svc = await service(S);
  const dev = await device(S);
  const res = await Promise.all(Array.from({ length: 20 }, () => join(S, dev, svc)));
  assert.equal(res.filter((r) => r === "OK").length, 1);
  assert.equal(res.filter((r) => r === "EXISTING").length, 19);
  assert.equal((await entries(S)).length, 1);
});

await test("fila rápida e totem ao mesmo tempo: mesma numeração, sem repetição", async () => {
  const S = await shop("mix");
  const svc = await service(S);
  const devs = await Promise.all(Array.from({ length: 10 }, () => device(S)));
  const totemClients = await Promise.all(Array.from({ length: 10 }, () => client(S)));
  await Promise.all([
    ...devs.map((d) => join(S, d, svc)),
    ...totemClients.map((c) => pool.query(`select public.join_queue_totem($1, $2, $3, null)`, [S, c, svc])),
  ]);
  const rows = await entries(S);
  assert.deepEqual(rows.map((e) => e.ticket_number), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(rows.filter((e) => e.source === "QUICK_QUEUE").length, 10);
  assert.equal(rows.filter((e) => e.source === null && e.phone_verified === null && e.device_id === null).length, 10);
});

await test("anon e authenticated não executam; service_role executa", async () => {
  const dev = await device(A);
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      asRole(role, (c) => join(A, dev, svcA, 3500, null, c)),
      (e) => e.code === "42501"
    );
  }
  assert.equal(await asRole("service_role", (c) => join(A, dev, svcA, 3500, null, c)), "OK");
});

await test("assinatura não aceita cliente nem número de senha", async () => {
  const { args } = await one(
    `select pg_get_function_identity_arguments(p.oid) as args from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'quick_queue_join'`
  );
  assert.equal(args, "p_tenant_id uuid, p_device_hash text, p_service_id uuid, p_price_cents integer, p_barber_id uuid");
});

await test("origem fora do permitido é recusada pela tabela", async () => {
  const c = await client(A);
  await assert.rejects(
    pool.query(
      `insert into public.queue_entries (tenant_id, client_id, ticket_number, source) values ($1, $2, 9999, 'OUTRA')`,
      [A, c]
    ),
    (e) => e.code === "23514"
  );
});

await test("migration re-executável", async () => {
  await pool.query(readFileSync(MIGRATION, "utf8"));
  await pool.query(readFileSync(MIGRATION, "utf8"));
  const S = await shop("rerun");
  assert.equal(await join(S, await device(S), await service(S)), "OK");
});

await pool.end();
console.log(`\n${passed} testes ok`);

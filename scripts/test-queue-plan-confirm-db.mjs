// Testes de banco do #100: início de atendimento da fila com "Usar plano" (schema-55) e as travas
// de privacidade que vivem no banco. SÓ em Supabase LOCAL descartável (loopback), com o ci-order
// aplicado. Dados fictícios. Cada execução cria barbearias novas com sufixo aleatório.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-queue-plan-confirm-db.mjs
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const pool = new pg.Pool({ ...localTarget(process.env.DATABASE_URL), max: 10 });

const RUN = randomBytes(3).toString("hex");
const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
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
let phoneSeq = 0;
const PHONE_BASE = 10_000_000 + Math.floor(Math.random() * 80_000_000);
const phone = () => `119${PHONE_BASE + ++phoneSeq}`;

async function user(t, role) {
  const uid = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [uid, `pc-${RUN}-${randomBytes(3).toString("hex")}@example.test`]
  );
  await pool.query(`insert into public.memberships (user_id, tenant_id, role) values ($1, $2, $3)`, [uid, t, role]);
  return uid;
}
async function shop(label) {
  const { id } = await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
     values ($1, $2, 'essencial', 'BARBERSHOP', true, true) returning id`,
    [`Barbearia ${label} Teste`, `pc-${label}-${RUN}`]
  );
  const svc = (await one(`insert into public.services (tenant_id, name, duration_min, price_brl) values ($1, 'Corte Teste', 30, 35) returning id`, [id])).id;
  const barber = (await one(`insert into public.barbers (tenant_id, name) values ($1, 'Barbeiro Teste') returning id`, [id])).id;
  return { id, svc, barber, admin: await user(id, "UNIT_ADMIN") };
}
const client = async (s) =>
  (await one(`insert into public.clients (tenant_id, name, phone, email) values ($1, 'Cliente Teste', $2, $3) returning id`, [
    s.id,
    phone(),
    `pc-${RUN}-${randomBytes(3).toString("hex")}@example.test`,
  ])).id;
async function plan(s, cid, { mode = "FLEXIBLE", saldo = 3 } = {}) {
  const pid = (await one(
    `insert into public.combo_plans (tenant_id, name, cuts, price_brl, booking_mode, service_id) values ($1, 'Plano Teste', 4, 100, $2, $3) returning id`,
    [s.id, mode, s.svc]
  )).id;
  await pool.query(
    `insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, saldo_cortes) values ($1, $2, $3, $4)`,
    [s.id, cid, pid, saldo]
  );
  return pid;
}
const saldo = async (cid) => (await one(`select saldo_cortes from public.client_subscriptions where client_id = $1 and status = 'ACTIVE'`, [cid])).saldo_cortes;
const ticket = async (s, cid) =>
  (await one(`select (public.join_queue_totem($1, $2, $3, null)).id as id`, [s.id, cid, s.svc])).id;
const entry = (id) => one(`select * from public.queue_entries where id = $1`, [id]);

async function asUser(uid, sql, params) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
const start = (uid, id, usePlan, barber = null, svc = null) =>
  asUser(uid, `select public.start_queue_entry($1, $2, $3, $4) as appt`, [id, usePlan, barber, svc]).then((r) => r.rows[0].appt);
const errIs = (code) => (e) => new RegExp(code).test(e.message);

// ---- Usar plano --------------------------------------------------------------------------------
await test("Usar plano (saldo): desconta 1, comanda do plano sem item avulso, registra quem e quando", async () => {
  const s = await shop("use");
  const cid = await client(s);
  const pid = await plan(s, cid, { saldo: 3 });
  const id = await ticket(s, cid);
  const appt = await start(s.admin, id, true);
  assert.equal(await saldo(cid), 2);
  const a = await one(`select * from public.appointments where id = $1`, [appt]);
  assert.equal(a.consumed_from_plan, true);
  assert.equal(a.combo_plan_id, pid);
  assert.equal(a.service_id, null);
  assert.equal((await one(`select count(*)::int n from public.appointment_items where appointment_id = $1`, [appt])).n, 0);
  const e = await entry(id);
  assert.equal(e.status, "IN_SERVICE");
  assert.equal(e.appointment_id, appt);
  assert.equal(e.plan_confirmed_by, s.admin);
  assert.ok(e.plan_confirmed_at);
});

await test("avulso para cliente de plano: saldo igual, comanda com o serviço, sem registro de plano", async () => {
  const s = await shop("avulso");
  const cid = await client(s);
  await plan(s, cid, { saldo: 3 });
  const id = await ticket(s, cid);
  const appt = await start(s.admin, id, false);
  assert.equal(await saldo(cid), 3);
  const a = await one(`select * from public.appointments where id = $1`, [appt]);
  assert.equal(a.consumed_from_plan, false);
  assert.equal(a.service_id, s.svc);
  const item = await one(`select * from public.appointment_items where appointment_id = $1`, [appt]);
  assert.equal(item.kind, "service");
  assert.equal(Number(item.price_brl), 35);
  assert.equal(item.covered_by_plan, false);
  const e = await entry(id);
  assert.equal(e.plan_confirmed_by, null);
  assert.equal(e.plan_confirmed_at, null);
});

await test("concluir sem confirmar não muda o saldo", async () => {
  const s = await shop("finish");
  const cid = await client(s);
  await plan(s, cid, { saldo: 2 });
  const id = await ticket(s, cid);
  await start(s.admin, id, false);
  await asUser(s.admin, `update public.queue_entries set status = 'DONE', ended_at = now() where id = $1`, [id]);
  assert.equal(await saldo(cid), 2);
});

await test("repetir a confirmação não desconta duas vezes (em série e ao mesmo tempo)", async () => {
  const s = await shop("repeat");
  const cid = await client(s);
  await plan(s, cid, { saldo: 5 });
  const id = await ticket(s, cid);
  const appts = await Promise.all([start(s.admin, id, true), start(s.admin, id, true), start(s.admin, id, true)]);
  assert.equal(new Set(appts).size, 1);
  assert.equal(await start(s.admin, id, true), appts[0]);
  assert.equal(await saldo(cid), 4);
  assert.equal((await one(`select count(*)::int n from public.appointments where client_id = $1`, [cid])).n, 1);
});

await test("plano fixo: 'Usar plano' recusado, nada muda; painel não oferece", async () => {
  const s = await shop("fixed");
  const cid = await client(s);
  await plan(s, cid, { mode: "FIXED", saldo: 3 });
  const id = await ticket(s, cid);
  await assert.rejects(start(s.admin, id, true), errIs("QUEUE_PLAN_FIXED"));
  assert.equal((await entry(id)).status, "WAITING");
  assert.equal(await saldo(cid), 3);
  assert.equal((await one(`select count(*)::int n from public.appointments where client_id = $1`, [cid])).n, 0);
  const { rows } = await asUser(s.admin, `select * from public.queue_plan_usable_clients($1)`, [[cid]]);
  assert.equal(rows.length, 0);
  // Avulso continua possível.
  await start(s.admin, id, false);
  assert.equal(await saldo(cid), 3);
});

await test("sem saldo ou sem plano: recusado e nada fica pela metade", async () => {
  const s = await shop("nosaldo");
  const zero = await client(s);
  await plan(s, zero, { saldo: 0 });
  const id0 = await ticket(s, zero);
  await assert.rejects(start(s.admin, id0, true), errIs("Sem saldo de cortes"));
  assert.equal((await entry(id0)).status, "WAITING");
  assert.equal((await one(`select count(*)::int n from public.appointments where client_id = $1`, [zero])).n, 0);
  const none = await client(s);
  const idN = await ticket(s, none);
  await assert.rejects(start(s.admin, idN, true), errIs("QUEUE_PLAN_NONE"));
  assert.equal((await entry(idN)).status, "WAITING");
});

// ---- Quem pode ---------------------------------------------------------------------------------
await test("cliente logado (fora da equipe) não inicia nem confirma; anon não executa", async () => {
  const s = await shop("client-role");
  const cid = await client(s);
  await plan(s, cid, { saldo: 3 });
  const id = await ticket(s, cid);
  const cu = await user(s.id, "CLIENT");
  await pool.query(`update public.clients set user_id = $2 where id = $1`, [cid, cu]); // o próprio cliente
  await assert.rejects(start(cu, id, true), errIs("QUEUE_FORBIDDEN"));
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role anon");
    await assert.rejects(c.query(`select public.start_queue_entry($1, true, null, null)`, [id]), (e) => e.code === "42501");
  } finally {
    await c.query("rollback");
    c.release();
  }
  assert.equal((await entry(id)).status, "WAITING");
  assert.equal(await saldo(cid), 3);
});

await test("equipe de outra barbearia não inicia nem lê quem aceita plano", async () => {
  const s = await shop("tenant-a");
  const o = await shop("tenant-b");
  const cid = await client(s);
  await plan(s, cid, { saldo: 3 });
  const id = await ticket(s, cid);
  await assert.rejects(start(o.admin, id, true), errIs("QUEUE_FORBIDDEN"));
  assert.equal(await saldo(cid), 3);
  const { rows } = await asUser(o.admin, `select * from public.queue_plan_usable_clients($1)`, [[cid]]);
  assert.equal(rows.length, 0);
  const own = await asUser(s.admin, `select * from public.queue_plan_usable_clients($1)`, [[cid]]);
  assert.deepEqual(own.rows.map((r) => r.queue_plan_usable_clients), [cid]);
});

await test("serviço ou barbeiro de outra barbearia: recusado, nada muda", async () => {
  const s = await shop("svc-a");
  const o = await shop("svc-b");
  const cid = await client(s);
  const id = await ticket(s, cid);
  await assert.rejects(start(s.admin, id, false, null, o.svc), errIs("QUEUE_SERVICE_NOT_IN_TENANT"));
  await assert.rejects(start(s.admin, id, false, o.barber, null), errIs("QUEUE_BARBER_NOT_IN_TENANT"));
  assert.equal((await entry(id)).status, "WAITING");
});

await test("senha da fila rápida segue a mesma regra (avulso por padrão; plano só confirmado)", async () => {
  const s = await shop("qq");
  const cid = await client(s);
  await plan(s, cid, { saldo: 2 });
  const h = hash();
  await pool.query(
    `insert into public.quick_queue_devices (tenant_id, token_hash, client_id, expires_at) values ($1, $2, $3, now() + interval '30 days')`,
    [s.id, h, cid]
  );
  const { r } = await one(`select public.quick_queue_join($1, $2, $3, 3500, null, 600, 1000, 1000, 1000, 30) as r`, [s.id, h, s.svc]);
  assert.equal(r, "OK");
  assert.equal(await saldo(cid), 2); // entrar não desconta
  const { id } = await one(`select id from public.queue_entries where client_id = $1`, [cid]);
  await start(s.admin, id, true);
  assert.equal(await saldo(cid), 1);
});

// ---- Privacidade no banco (T1 / T2) ------------------------------------------------------------
await test("identificação: telefone conhecido com plano e sem plano dão resposta idêntica", async () => {
  const s = await shop("priv");
  const withPlan = await client(s);
  await plan(s, withPlan, { saldo: 3 });
  const without = await client(s);
  const keyOf = async (cid) => (await one(`select public.br_phone_key(phone) k from public.clients where id = $1`, [cid])).k;
  const ask = async (cid) => {
    const { rows } = await pool.query(
      `select * from public.quick_queue_identify($1, null, $2, $3, null, 600, 5, 5, 200, 60, 100, 30, 10)`,
      [s.id, hash(), await keyOf(cid)]
    );
    return rows;
  };
  const a = await ask(withPlan);
  const b = await ask(without);
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a[0]).sort(), ["new_device", "result"]);
  assert.equal(a[0].result, "KNOWN");
});

await test("sem login (anon) não lê plano, agendamentos, pagamentos nem fichas", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role anon");
    for (const t of ["client_subscriptions", "appointments", "payments", "clients", "queue_entries"]) {
      const r = await c.query(`select count(*)::int n from public.${t}`).catch((e) => ({ denied: e.code }));
      assert.ok(r.denied === "42501" || r.rows[0].n === 0, t);
    }
  } finally {
    await c.query("rollback");
    c.release();
  }
});

await test("migration 55 re-executável", async () => {
  const sql = readFileSync(new URL("../supabase/schema-55-queue-plan-confirm.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(sql);
});

await pool.end();
console.log(`\n${passed} testes ok`);

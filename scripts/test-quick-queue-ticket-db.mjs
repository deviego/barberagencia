// Testes de banco da tela "Minha senha" (#98): src/features/quick-queue/ticket.ts + schema-61.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Usa o código de verdade do servidor (ticket.ts, rules.ts) com o cliente service role da pilha
// local, e o Postgres direto para montar o cenário. Cada execução cria barbearias novas.
// Uso:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres \
//   SUPABASE_URL=http://127.0.0.1:<porta-api> SUPABASE_SERVICE_ROLE_KEY=<chave da pilha local> \
//   node scripts/test-quick-queue-ticket-db.mjs
import { registerHooks, createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";
import { localTarget } from "./lib/schema-apply.mjs";

const require = createRequire(import.meta.url);
const pg = require("pg");
const { createClient } = require("@supabase/supabase-js");

for (const v of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[v]) {
    console.error(`✗ Defina ${v} (Supabase local).`);
    process.exit(1);
  }
}
const config = localTarget(process.env.DATABASE_URL); // recusa host que não seja loopback
const apiHost = new URL(process.env.SUPABASE_URL).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(apiHost)) {
  console.error("✗ SUPABASE_URL precisa ser a pilha local (loopback).");
  process.exit(1);
}
const pool = new pg.Pool({ ...config, max: 10 });
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") && context.parentURL.endsWith(".ts")) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target && !existsSync(target)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith("file:") || !url.endsWith(".ts")) return next(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});

const ticket = await import("@/features/quick-queue/ticket");
const { quickQueueMyTicket } = await import("@/features/quick-queue/ticket-rules");

const RUN = randomBytes(3).toString("hex");
const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
const LOOSE = [600, 1000, 1000, 1000, 30];
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

async function shop(label) {
  const { id } = await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
     values ($1, $2, 'essencial', 'BARBERSHOP', true, true) returning id`,
    [`Barbearia ${label} Teste`, `qt-${label}-${RUN}`]
  );
  const svc = (await one(`insert into public.services (tenant_id, name, duration_min, price_brl) values ($1, 'Corte Teste', 30, 35) returning id`, [id])).id;
  return { id, svc };
}
async function client(t, userId = null) {
  return (
    await one(`insert into public.clients (tenant_id, name, phone, email, user_id) values ($1, 'Cliente Teste', $2, $3, $4) returning id`, [
      t,
      `119${PHONE_BASE + ++phoneSeq}`,
      `qt-${RUN}-${randomBytes(3).toString("hex")}@example.test`,
      userId,
    ])
  ).id;
}
async function device(t, clientId) {
  const h = hash();
  const cid = clientId ?? (await client(t));
  // last_used_at no passado: a primeira consulta do teste não cai no limite de 2 s.
  const { id } = await one(
    `insert into public.quick_queue_devices (tenant_id, token_hash, client_id, expires_at, last_used_at)
     values ($1, $2, $3, now() + interval '30 days', now() - interval '1 minute') returning id`,
    [t, h, cid]
  );
  return { hash: h, id, clientId: cid };
}
async function join(s, dev) {
  const { r } = await one(`select public.quick_queue_join($1, $2, $3, 3500, null, $4, $5, $6, $7, $8) as r`, [s.id, dev.hash, s.svc, ...LOOSE]);
  await pool.query(`update public.quick_queue_devices set last_used_at = now() - interval '1 minute' where id = $1`, [dev.id]);
  return r;
}
const rewind = (dev) => pool.query(`update public.quick_queue_devices set last_used_at = now() - interval '1 minute' where id = $1`, [dev.id]);

/** O que a rota GET /status devolveria para este aparelho (mesmas funções, mesma ordem). */
async function status(s, dev) {
  await rewind(dev);
  const slot = await ticket.claimStatusSlot(admin, s.id, dev.hash);
  if (slot === "error") throw new Error("leitura falhou");
  if (slot === "limited") return "LIMIT";
  if (!slot) return null;
  const mine = await ticket.loadDeviceTicket(admin, s.id, slot.deviceId);
  const snap = await ticket.loadSnapshot(admin, s.id);
  assert.notEqual(mine, "error");
  assert.notEqual(snap, "error");
  return mine ? quickQueueMyTicket(mine, snap) : null;
}
const sleepPastSnapshot = () => new Promise((r) => setTimeout(r, 2_100));
const row = (s, n) => one(`select * from public.queue_entries where tenant_id = $1 and ticket_number = $2`, [s.id, n]);

async function clientUser(t) {
  const uid = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [uid, `qt-${RUN}-${randomBytes(3).toString("hex")}@example.test`]
  );
  if (t) await pool.query(`insert into public.memberships (user_id, tenant_id, role) values ($1, $2, 'CLIENT')`, [uid, t]);
  return uid;
}
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

// ---- Estados -------------------------------------------------------------------------------------
await test("WAITING com gente na frente, NEXT, CALLED; nowServing e ahead certos", async () => {
  const s = await shop("states");
  const devs = [];
  for (let i = 0; i < 3; i++) {
    const d = await device(s.id);
    assert.equal(await join(s, d), "OK");
    devs.push(d);
  }
  assert.deepEqual(await status(s, devs[2]), { number: 3, state: "WAITING", nowServing: null, ahead: 2 });
  await pool.query(`update public.queue_entries set called_at = now() where tenant_id = $1 and ticket_number = 1`, [s.id]);
  await sleepPastSnapshot();
  assert.deepEqual(await status(s, devs[0]), { number: 1, state: "CALLED", nowServing: 1, ahead: 0 });
  assert.deepEqual(await status(s, devs[1]), { number: 2, state: "NEXT", nowServing: 1, ahead: 0 });
  assert.deepEqual(await status(s, devs[2]), { number: 3, state: "WAITING", nowServing: 1, ahead: 1 });
});

await test("finais: DONE, SKIPPED (removida pela barbearia) e CANCELLED (saiu pela tela)", async () => {
  const s = await shop("finals");
  const [a, b, c] = [await device(s.id), await device(s.id), await device(s.id)];
  for (const d of [a, b, c]) assert.equal(await join(s, d), "OK");
  await pool.query(`update public.queue_entries set status = 'DONE' where tenant_id = $1 and ticket_number = 1`, [s.id]);
  await pool.query(`update public.queue_entries set status = 'LEFT' where tenant_id = $1 and ticket_number = 2`, [s.id]);
  assert.equal(await ticket.cancelDeviceTicket(admin, s.id, c.id), "cancelled");
  assert.equal((await status(s, a)).state, "DONE");
  assert.equal((await status(s, b)).state, "SKIPPED");
  assert.equal((await status(s, c)).state, "CANCELLED");
});

await test("resposta só com número, estado, senha atendida e contagem", async () => {
  const s = await shop("shape");
  const d = await device(s.id);
  assert.equal(await join(s, d), "OK");
  assert.deepEqual(Object.keys(await status(s, d)).sort(), ["ahead", "nowServing", "number", "state"]);
});

// ---- Posse da senha ------------------------------------------------------------------------------
await test("aparelho sem senha, credencial inventada ou de outra barbearia: ticket null", async () => {
  const s = await shop("none");
  const o = await shop("none-other");
  const d = await device(s.id);
  assert.equal(await status(s, d), null);
  assert.equal(await status(s, { id: randomUUID(), hash: hash() }), null);
  const od = await device(o.id);
  assert.equal(await join(o, od), "OK");
  assert.equal(await status(s, od), null); // cookie de outra barbearia
});

await test("outro aparelho do mesmo cliente não vê nem cancela a senha", async () => {
  const s = await shop("other-dev");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  const b = await device(s.id, a.clientId);
  assert.equal(await status(s, b), null);
  assert.equal(await ticket.cancelDeviceTicket(admin, s.id, b.id), "not_waiting");
  assert.equal((await row(s, 1)).status, "WAITING");
});

await test("totem assume a senha da fila rápida: device_id zerado; A não vê nem sai", async () => {
  const s = await shop("totem-takes");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  await pool.query(`select public.join_queue_totem($1, $2, null, null)`, [s.id, a.clientId]);
  const r = await row(s, 1);
  assert.equal(r.device_id, null);
  assert.equal(r.status, "WAITING");
  assert.equal(r.source, "QUICK_QUEUE");
  assert.equal(await status(s, a), null);
  assert.equal(await ticket.cancelDeviceTicket(admin, s.id, a.id), "not_waiting");
  assert.equal((await row(s, 1)).status, "WAITING");
});

await test("app (cliente logado) assume a senha da fila rápida: device_id zerado; A não vê nem sai", async () => {
  const s = await shop("app-takes");
  const uid = await clientUser(s.id);
  const cid = await client(s.id, uid);
  const a = await device(s.id, cid);
  assert.equal(await join(s, a), "OK");
  const { rows } = await asUser(uid, `select ticket_number from public.join_queue($1, null, null)`, [s.id]);
  assert.equal(rows[0].ticket_number, 1);
  assert.equal((await row(s, 1)).device_id, null);
  assert.equal(await status(s, a), null);
  assert.equal(await ticket.cancelDeviceTicket(admin, s.id, a.id), "not_waiting");
  assert.equal((await row(s, 1)).status, "WAITING");
});

await test("senha que nasceu no totem continua igual quando o totem a devolve de novo", async () => {
  const s = await shop("totem-born");
  const cid = await client(s.id);
  await pool.query(`select public.join_queue_totem($1, $2, $3, null)`, [s.id, cid, s.svc]);
  const before = await row(s, 1);
  await pool.query(`select public.join_queue_totem($1, $2, null, null)`, [s.id, cid]);
  assert.deepEqual(await row(s, 1), before);
});

await test("app nasce e devolve a própria senha sem mudança (sem aparelho)", async () => {
  const s = await shop("app-born");
  const uid = await clientUser(s.id);
  await client(s.id, uid);
  await asUser(uid, `select public.join_queue($1, $2, null)`, [s.id, s.svc]);
  const before = await row(s, 1);
  await asUser(uid, `select public.join_queue($1, null, null)`, [s.id]);
  assert.deepEqual(await row(s, 1), before);
});

// ---- Sair da fila -------------------------------------------------------------------------------
await test("sair: cancela a senha em espera; repetir responde 'already' sem efeito novo", async () => {
  const s = await shop("leave");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  assert.equal(await ticket.cancelDeviceTicket(admin, s.id, a.id), "cancelled");
  const after = await row(s, 1);
  assert.equal(after.status, "LEFT");
  assert.equal(after.left_by_client, true);
  assert.equal(await ticket.cancelDeviceTicket(admin, s.id, a.id), "already");
  assert.deepEqual(await row(s, 1), after);
});

await test("sair: senha chamada, em atendimento ou encerrada é recusada", async () => {
  const s = await shop("leave-no");
  const cases = [
    `update public.queue_entries set called_at = now() where id = $1`,
    `update public.queue_entries set status = 'IN_SERVICE', called_at = now() where id = $1`,
    `update public.queue_entries set status = 'DONE' where id = $1`,
  ];
  for (const sql of cases) {
    const d = await device(s.id);
    assert.equal(await join(s, d), "OK");
    const { id } = await one(`select id from public.queue_entries where device_id = $1`, [d.id]);
    await pool.query(sql, [id]);
    const before = await one(`select status, left_by_client from public.queue_entries where id = $1`, [id]);
    assert.equal(await ticket.cancelDeviceTicket(admin, s.id, d.id), "not_waiting");
    assert.deepEqual(await one(`select status, left_by_client from public.queue_entries where id = $1`, [id]), before);
  }
});

await test("aparelho de outra barbearia não cancela (filtro por barbearia)", async () => {
  const s = await shop("leave-x");
  const o = await shop("leave-x-other");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  assert.equal(await ticket.cancelDeviceTicket(admin, o.id, a.id), "not_waiting");
  assert.equal((await row(s, 1)).status, "WAITING");
});

// ---- Senha de dia anterior e limite da consulta ---------------------------------------------------
await test("senha de ontem não aparece", async () => {
  const s = await shop("yesterday");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  await pool.query(`update public.queue_entries set day = day - 1 where tenant_id = $1`, [s.id]);
  assert.equal(await status(s, a), null);
});

await test("duas consultas em menos de 2 s do mesmo aparelho: a segunda é LIMIT, sem gravar linha", async () => {
  const s = await shop("limit");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  const before = (await one(`select count(*)::int n from public.rate_limit_events`)).n;
  assert.notEqual(await status(s, a), "LIMIT");
  assert.equal(await ticket.claimStatusSlot(admin, s.id, a.hash), "limited");
  assert.equal((await one(`select count(*)::int n from public.rate_limit_events`)).n, before);
});

await test("aparelho com 2 senhas ativas (pai e filho): mostra a de número menor", async () => {
  const s = await shop("two");
  const a = await device(s.id);
  assert.equal(await join(s, a), "OK");
  await pool.query(`update public.quick_queue_devices set client_id = $2 where id = $1`, [a.id, await client(s.id)]);
  assert.equal(await join(s, a), "OK");
  assert.equal((await status(s, a)).number, 1);
});

await test("migration 61 re-executável", async () => {
  const sql = readFileSync(new URL("../supabase/schema-61-quick-queue-ticket-owner.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(sql);
});

await pool.end();
console.log(`\n${passed} testes ok`);

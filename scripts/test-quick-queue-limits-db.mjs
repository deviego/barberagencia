// Testes de banco das travas da fila rápida (#99): schema-54.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Cada execução cria barbearias novas com sufixo aleatório e não apaga nada.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-quick-queue-limits-db.mjs
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
const config = localTarget(process.env.DATABASE_URL); // recusa qualquer host que não seja loopback
const pool = new pg.Pool({ ...config, max: 25 });

const RUN = randomBytes(3).toString("hex");
const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
const MIGRATION = new URL("../supabase/schema-54-quick-queue-limits.sql", import.meta.url);
// Valores de src/features/quick-queue/limits.ts (QUICK_QUEUE_JOIN_LIMITS) e TTL de 30 dias.
const DEFAULTS = { window: 600, perDevice: 10, activePerDevice: 2, tenantCap: 40, ttl: 30 };

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
const fakePhone = () => `119${PHONE_BASE + ++phoneSeq}`;

async function shop(label, { plan = "essencial", trialEnds = null, mode = "APP" } = {}) {
  const { id } = await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
     values ($1, $2, $3, 'BARBERSHOP', true, true) returning id`,
    [`Barbearia ${label} Teste`, `ql-${label}-${RUN}`, plan]
  );
  await pool.query(
    `insert into public.tenant_settings (tenant_id, queue_mode) values ($1, $2)
     on conflict (tenant_id) do update set queue_mode = excluded.queue_mode`,
    [id, mode]
  );
  if (trialEnds) {
    await pool.query(
      `insert into public.tenant_contracts (tenant_id, trial_ends_at) values ($1, now() + $2::interval)
       on conflict (tenant_id) do update set trial_ends_at = excluded.trial_ends_at`,
      [id, trialEnds]
    );
  }
  return id;
}
const service = async (t) =>
  (await one(`insert into public.services (tenant_id, name, duration_min, price_brl) values ($1, 'Corte Teste', 30, 35) returning id`, [t])).id;
const client = async (t) =>
  (
    await one(`insert into public.clients (tenant_id, name, phone, email) values ($1, 'Cliente Teste', $2, $3) returning id`, [
      t,
      fakePhone(),
      `ql-${RUN}-${randomBytes(3).toString("hex")}@example.test`,
    ])
  ).id;
async function device(t, { clientId, expires = "30 days" } = {}) {
  const h = hash();
  const cid = clientId === undefined ? await client(t) : clientId;
  const { id } = await one(
    `insert into public.quick_queue_devices (tenant_id, token_hash, client_id, expires_at)
     values ($1, $2, $3, now() + $4::interval) returning id`,
    [t, h, cid, expires]
  );
  return { hash: h, id, clientId: cid };
}
/** O passo do telefone liga o aparelho a outro cliente (pai e filho no mesmo celular). */
const rebind = async (dev, clientId) => {
  await pool.query(`update public.quick_queue_devices set client_id = $2 where id = $1`, [dev.id, clientId]);
  dev.clientId = clientId;
};

async function join(t, dev, svc, lim = {}, c = pool) {
  const l = { ...DEFAULTS, ...lim };
  const { rows } = await c.query(
    `select public.quick_queue_join($1, $2, $3, 3500, null, $4, $5, $6, $7, $8) as r`,
    [t, dev.hash, svc, l.window, l.perDevice, l.activePerDevice, l.tenantCap, l.ttl]
  );
  return rows[0].r;
}
const active = (t) =>
  pool
    .query(`select * from public.queue_entries where tenant_id = $1 and status in ('WAITING','IN_SERVICE') order by ticket_number`, [t])
    .then((r) => r.rows);
const hits = async (t, kind) =>
  Number(
    (
      await pool.query(
        `select coalesce(sum(hits), 0) n from public.quick_queue_limit_daily where tenant_id = $1 and kind = $2`,
        [t, kind]
      )
    ).rows[0].n
  );
const totem = (t, cid, svc) => pool.query(`select public.join_queue_totem($1, $2, $3, null)`, [t, cid, svc]);

async function adminUser(t, label) {
  const uid = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [uid, `ql-${label}-${RUN}@example.test`]
  );
  await pool.query(`insert into public.memberships (user_id, tenant_id, role) values ($1, $2, 'UNIT_ADMIN')`, [uid, t]);
  return uid;
}
async function asRole(role, fn, uid = null) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    if (uid) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role })]);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// ---- 1 senha ativa por telefone --------------------------------------------------------------------
await test("telefone com senha tirada no totem: PHONE_BUSY, nenhuma senha nova, contagem do dia sobe", async () => {
  const S = await shop("totem-busy");
  const svc = await service(S);
  const dev = await device(S);
  await totem(S, dev.clientId, svc);
  assert.equal(await join(S, dev, svc), "PHONE_BUSY");
  assert.equal((await active(S)).length, 1);
  assert.equal(await hits(S, "PHONE_BUSY"), 1);
});

await test("mesmo telefone em outro aparelho: PHONE_BUSY (não devolve a senha do outro)", async () => {
  const S = await shop("other-dev");
  const svc = await service(S);
  const devA = await device(S);
  assert.equal(await join(S, devA, svc), "OK");
  const devB = await device(S, { clientId: devA.clientId });
  assert.equal(await join(S, devB, svc), "PHONE_BUSY");
  assert.equal((await active(S)).length, 1);
});

await test("senha do próprio aparelho volta como EXISTING antes da conferência de preço", async () => {
  const S = await shop("own");
  const svc = await service(S);
  const dev = await device(S);
  assert.equal(await join(S, dev, svc), "OK");
  const { rows } = await pool.query(
    `select public.quick_queue_join($1, $2, $3, 1, null, 600, 10, 2, 40, 30) as r`,
    [S, dev.hash, svc]
  );
  assert.equal(rows[0].r, "EXISTING");
});

await test("senha encerrada (atendida ou removida): o mesmo telefone pega outra", async () => {
  const S = await shop("ended");
  const svc = await service(S);
  const dev = await device(S);
  for (const status of ["DONE", "LEFT"]) {
    assert.equal(await join(S, dev, svc), "OK");
    await pool.query(`update public.queue_entries set status = $2 where tenant_id = $1 and status = 'WAITING'`, [S, status]);
  }
  assert.equal(await join(S, dev, svc), "OK");
});

await test("regra do banco: segunda senha ativa do mesmo cliente no dia é recusada (qualquer origem)", async () => {
  const S = await shop("uq");
  const svc = await service(S);
  const cid = await client(S);
  await totem(S, cid, svc);
  await assert.rejects(
    pool.query(
      `insert into public.queue_entries (tenant_id, client_id, ticket_number, service_id) values ($1, $2, 999, $3)`,
      [S, cid, svc]
    ),
    (e) => e.code === "23505" && e.constraint === "uq_queue_active_client_day"
  );
});

await test("totem para cliente com senha da fila rápida: devolve a existente, sem duplicar", async () => {
  const S = await shop("qq-then-totem");
  const svc = await service(S);
  const dev = await device(S);
  assert.equal(await join(S, dev, svc), "OK");
  await totem(S, dev.clientId, svc);
  assert.equal((await active(S)).length, 1);
});

await test("20 pedidos simultâneos do mesmo telefone em 20 aparelhos: uma senha só", async () => {
  const S = await shop("conc-phone");
  const svc = await service(S);
  const cid = await client(S);
  const devs = await Promise.all(Array.from({ length: 20 }, () => device(S, { clientId: cid })));
  const res = await Promise.all(devs.map((d) => join(S, d, svc)));
  assert.equal(res.filter((r) => r === "OK").length, 1);
  assert.equal(res.filter((r) => r === "PHONE_BUSY").length, 19);
  assert.equal((await active(S)).length, 1);
});

// ---- 2 senhas ativas por aparelho -----------------------------------------------------------------
await test("aparelho com 2 senhas ativas: a terceira é DEVICE_LIMIT", async () => {
  const S = await shop("dev2");
  const svc = await service(S);
  const dev = await device(S);
  assert.equal(await join(S, dev, svc), "OK");
  await rebind(dev, await client(S));
  assert.equal(await join(S, dev, svc), "OK");
  await rebind(dev, await client(S));
  assert.equal(await join(S, dev, svc), "DEVICE_LIMIT");
  assert.equal((await active(S)).length, 2);
  assert.equal(await hits(S, "DEVICE_ACTIVE"), 1);
});

await test("senha encerrada libera a vaga do aparelho", async () => {
  const S = await shop("dev2-free");
  const svc = await service(S);
  const dev = await device(S);
  assert.equal(await join(S, dev, svc), "OK");
  await rebind(dev, await client(S));
  assert.equal(await join(S, dev, svc), "OK");
  await pool.query(`update public.queue_entries set status = 'DONE' where tenant_id = $1 and ticket_number = 1`, [S]);
  await rebind(dev, await client(S));
  assert.equal(await join(S, dev, svc), "OK");
});

// ---- Pedidos por aparelho -------------------------------------------------------------------------
await test("pedidos em série acima do limite: RATE_LIMIT, contados por aparelho", async () => {
  const S = await shop("rate");
  const svc = await service(S);
  const dev = await device(S);
  const res = [];
  for (let i = 0; i < 4; i++) res.push(await join(S, dev, svc, { perDevice: 3 }));
  assert.deepEqual(res, ["OK", "EXISTING", "EXISTING", "RATE_LIMIT"]);
  assert.equal(await hits(S, "JOIN_RATE"), 1);
  assert.equal(await join(S, await device(S), svc, { perDevice: 3 }), "OK"); // outro aparelho segue
});

// ---- Teto por barbearia --------------------------------------------------------------------------
await test("teto de senhas da fila rápida: acima dele TENANT_CAP; totem continua; outra barbearia não sente", async () => {
  const S = await shop("cap");
  const svc = await service(S);
  for (let i = 0; i < 3; i++) assert.equal(await join(S, await device(S), svc, { tenantCap: 3 }), "OK");
  assert.equal(await join(S, await device(S), svc, { tenantCap: 3 }), "TENANT_CAP");
  assert.equal(await hits(S, "TENANT_ACTIVE"), 1);
  await totem(S, await client(S), svc);
  assert.equal((await active(S)).length, 4);
  const O = await shop("cap-other");
  assert.equal(await join(O, await device(O), await service(O), { tenantCap: 3 }), "OK");
  assert.equal(await hits(O, "TENANT_ACTIVE"), 0);
});

await test("20 pedidos simultâneos com teto 5: exatamente 5 senhas", async () => {
  const S = await shop("cap-conc");
  const svc = await service(S);
  const devs = await Promise.all(Array.from({ length: 20 }, () => device(S)));
  const res = await Promise.all(devs.map((d) => join(S, d, svc, { tenantCap: 5 })));
  assert.equal(res.filter((r) => r === "OK").length, 5);
  assert.equal(res.filter((r) => r === "TENANT_CAP").length, 15);
  assert.deepEqual((await active(S)).map((e) => e.ticket_number), [1, 2, 3, 4, 5]);
});

// ---- Plano e modo dentro da função (nit do #143) ----------------------------------------------------
await test("Personal depois do teste e modo só totem: CLOSED; Personal no teste: OK", async () => {
  const P = await shop("personal-off", { plan: "personal", trialEnds: "-1 day" });
  assert.equal(await join(P, await device(P), await service(P)), "CLOSED");
  const T = await shop("totem-mode", { mode: "TOTEM" });
  assert.equal(await join(T, await device(T), await service(T)), "CLOSED");
  const PT = await shop("personal-trial", { plan: "personal", trialEnds: "5 days" });
  assert.equal(await join(PT, await device(PT), await service(PT)), "OK");
});

// ---- Credencial renovada (nit do #143) ---------------------------------------------------------------
await test("senha criada renova a validade da credencial para 30 dias", async () => {
  const S = await shop("ttl");
  const dev = await device(S, { expires: "1 day" });
  assert.equal(await join(S, dev, await service(S)), "OK");
  const { days } = await one(
    `select extract(epoch from (expires_at - now())) / 86400 as days from public.quick_queue_devices where id = $1`,
    [dev.id]
  );
  assert.ok(days > 29.9 && days <= 30, `validade ${days}`);
});

// ---- Contagem do dia: só admin da própria barbearia lê ------------------------------------------
await test("contagem do dia: admin lê a da própria barbearia, não a de outra; anon não lê", async () => {
  const S = await shop("rls-a");
  const O = await shop("rls-b");
  for (const t of [S, O]) await pool.query(`select public.quick_queue_record_limit($1, 'IDENTIFY')`, [t]);
  const uid = await adminUser(S, "rls");
  const rows = await asRole("authenticated", (c) => c.query(`select tenant_id from public.quick_queue_limit_daily`).then((r) => r.rows), uid);
  assert.ok(rows.length >= 1 && rows.every((r) => r.tenant_id === S));
  await assert.rejects(asRole("anon", (c) => c.query(`select * from public.quick_queue_limit_daily`)), (e) => e.code === "42501");
  await assert.rejects(
    asRole("authenticated", (c) => c.query(`insert into public.quick_queue_limit_daily (tenant_id, day, kind) values ($1, current_date, 'IDENTIFY')`, [S]), uid),
    (e) => e.code === "42501"
  );
});

await test("anon e authenticated não executam join nem o registro de limite", async () => {
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      asRole(role, (c) => c.query(`select public.quick_queue_record_limit($1, 'IDENTIFY')`, [randomUUID()])),
      (e) => e.code === "42501"
    );
    await assert.rejects(
      asRole(role, (c) => c.query(`select public.quick_queue_join($1, $2, $3, 1, null, 600, 10, 2, 40, 30)`, [randomUUID(), hash(), randomUUID()])),
      (e) => e.code === "42501"
    );
  }
});

await test("versão de 5 parâmetros da schema-53 não existe mais", async () => {
  const { n } = await one(
    `select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = 'quick_queue_join'`
  );
  assert.equal(n, 1);
});

await test("(#98) left_by_client existe e nasce nula", async () => {
  const S = await shop("left-by");
  assert.equal(await join(S, await device(S), await service(S)), "OK");
  assert.equal((await active(S))[0].left_by_client, null);
});

await test("migration re-executável; com senha ativa repetida ela para sem mudar nada", async () => {
  await pool.query(readFileSync(MIGRATION, "utf8"));
  const c = await pool.connect();
  try {
    await c.query("begin");
    const S = await shop("dup");
    const cid = await client(S);
    await c.query(`drop index public.uq_queue_active_client_day`);
    await c.query(`insert into public.queue_entries (tenant_id, client_id, ticket_number) values ($1, $2, 1), ($1, $2, 2)`, [S, cid]);
    await assert.rejects(c.query(readFileSync(MIGRATION, "utf8")), (e) => /QQ54_DUPLICATE_ACTIVE/.test(e.message));
  } finally {
    await c.query("rollback");
    c.release();
  }
  const { n } = await one(`select count(*)::int n from pg_indexes where indexname = 'uq_queue_active_client_day'`);
  assert.equal(n, 1);
});

await pool.end();
console.log(`\n${passed} testes ok`);

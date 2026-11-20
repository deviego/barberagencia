// Testes de banco da schema-64 (#148): tetos POR BARBEARIA da identificação com resultado próprio
// e os tipos novos na contagem do dia. SÓ em Supabase LOCAL descartável (loopback), com o
// ci-order aplicado. Dados fictícios. Cada execução cria barbearias novas com sufixo aleatório.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-quick-queue-identify-caps-db.mjs
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
const pool = new pg.Pool({ ...localTarget(process.env.DATABASE_URL), max: 5 });
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
const one = async (sql, p = []) => (await pool.query(sql, p)).rows[0];
let seq = 0;
const BASE = 10_000_000 + Math.floor(Math.random() * 80_000_000);
const phoneKey = () => `119${BASE + ++seq}`;
const L = { window: 600, device: 5, client: 5, tenant: 200, devicesHour: 60, clientsDay: 100, ttl: 30, pending: 10 };

async function shop(label) {
  return (await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
     values ($1, $2, 'essencial', 'BARBERSHOP', true, true) returning id`,
    [`Barbearia ${label} Teste`, `ic-${label}-${RUN}`]
  )).id;
}
/** Chama a identificação. dev = { current, fresh }; step = { phone } | { name }. */
async function identify(t, dev, step, lim = {}) {
  const l = { ...L, ...lim };
  const { rows } = await pool.query(
    `select * from public.quick_queue_identify($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [t, dev.current, dev.fresh ?? null, step.phone ?? null, step.name ?? null, l.window, l.device, l.client, l.tenant, l.devicesHour, l.clientsDay, l.ttl, l.pending]
  );
  const r = rows[0];
  if (r.new_device) dev.current = dev.fresh;
  dev.fresh = hash();
  return r.result;
}
const newDev = () => ({ current: null, fresh: hash() });

await test("limite por aparelho continua LIMIT (pessoal), não teto da barbearia", async () => {
  const t = await shop("dev");
  const d = newDev();
  const res = [];
  for (let i = 0; i < 3; i++) res.push(await identify(t, d, { phone: phoneKey() }, { device: 2 }));
  assert.equal(res[2], "LIMIT");
});

await test("teto de tentativas da barbearia: TENANT_ATTEMPTS", async () => {
  const t = await shop("att");
  const res = [];
  for (let i = 0; i < 4; i++) res.push(await identify(t, newDev(), { phone: phoneKey() }, { tenant: 3 }));
  assert.equal(res[3], "TENANT_ATTEMPTS");
});

await test("teto de credenciais novas por hora: TENANT_NEW_DEVICES", async () => {
  const t = await shop("ndev");
  const res = [];
  for (let i = 0; i < 3; i++) res.push(await identify(t, newDev(), { phone: phoneKey() }, { devicesHour: 2 }));
  assert.equal(res[2], "TENANT_NEW_DEVICES");
});

await test("teto de contas novas no dia: TENANT_NEW_CLIENTS (nenhuma conta criada além do teto)", async () => {
  const t = await shop("ncli");
  const make = async () => {
    const d = newDev();
    const r1 = await identify(t, d, { phone: phoneKey() }, { clientsDay: 2 });
    if (r1 !== "NEED_NAME") return r1;
    return identify(t, d, { name: "Cliente Teste" }, { clientsDay: 2 });
  };
  assert.deepEqual([await make(), await make(), await make()], ["CREATED", "CREATED", "TENANT_NEW_CLIENTS"]);
  const { n } = await one(`select count(*)::int n from public.clients where tenant_id = $1 and signup_origin = 'QUICK_QUEUE'`, [t]);
  assert.equal(n, 2);
});

await test("contagem do dia aceita os tipos novos; tipo desconhecido segue recusado", async () => {
  const t = await shop("kinds");
  for (const k of ["IDENTIFY_TENANT", "NEW_DEVICES_TENANT", "NEW_CLIENTS_TENANT", "IDENTIFY", "TENANT_ACTIVE"]) {
    await pool.query(`select public.quick_queue_record_limit($1, $2)`, [t, k]);
  }
  const { n } = await one(`select count(*)::int n from public.quick_queue_limit_daily where tenant_id = $1`, [t]);
  assert.equal(n, 5);
  await assert.rejects(pool.query(`select public.quick_queue_record_limit($1, 'OUTRO')`, [t]), (e) => e.code === "23514");
});

await test("assinatura e permissões iguais às da schema-52", async () => {
  const { args, sec } = await one(
    `select pg_get_function_identity_arguments(p.oid) args, p.prosecdef sec from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'quick_queue_identify'`
  );
  assert.equal(
    args,
    "p_tenant_id uuid, p_device_hash text, p_new_device_hash text, p_phone_key text, p_name text, p_window_seconds integer, p_per_device integer, p_per_client integer, p_per_tenant integer, p_new_devices_hour integer, p_new_clients_day integer, p_device_ttl_days integer, p_pending_minutes integer"
  );
  assert.equal(sec, true);
  for (const role of ["anon", "authenticated"]) {
    const { ok } = await one(`select has_function_privilege($1, 'public.quick_queue_identify(uuid, text, text, text, text, int, int, int, int, int, int, int, int)', 'execute') ok`, [role]);
    assert.equal(ok, false, role);
  }
});

await test("migration 64 re-executável", async () => {
  const sql = readFileSync(new URL("../supabase/schema-64-quick-queue-identify-tenant-caps.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(sql);
});

await pool.end();
console.log(`\n${passed} testes ok`);

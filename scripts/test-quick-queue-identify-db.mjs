// Testes de banco da identificação da fila rápida (#96): schema-52 + quick_queue_identify.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Cada execução cria barbearias novas com sufixo aleatório e não apaga nada.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-quick-queue-identify-db.mjs
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const LIMITS = { window: 600, device: 5, client: 5, tenant: 200, devicesHour: 60, clientsDay: 100, ttl: 30, pending: 10 };

const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");

async function shop(label, over = {}) {
  const slug = `qq-${label}-${RUN}`;
  const { rows } = await pool.query(
    `insert into public.tenants (name, subdomain, saas_plan, kind, queue_enabled, quick_queue_enabled)
     values ($1, $2, 'essencial', 'BARBERSHOP', true, $3) returning id`,
    [`Barbearia ${label} Teste`, slug, over.quick ?? true]
  );
  return rows[0].id;
}

/** Chama a RPC. step: { phone } ou { name }. limits: sobrescreve os valores padrão do teste. */
async function identify(tenantId, device, step, limits = {}, client = pool) {
  const l = { ...LIMITS, ...limits };
  const { rows } = await client.query(
    `select * from public.quick_queue_identify($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      tenantId,
      device.current,
      device.fresh ?? null,
      step.phone ?? null,
      step.name ?? null,
      l.window,
      l.device,
      l.client,
      l.tenant,
      l.devicesHour,
      l.clientsDay,
      l.ttl,
      l.pending,
    ]
  );
  const r = rows[0];
  if (r.new_device) device.current = device.fresh; // o servidor grava o cookie novo
  device.fresh = hash();
  return r.result;
}
const newDevice = () => ({ current: null, fresh: hash() });

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

// TS e SQL precisam dar a mesma chave.
const { phoneKey } = await import("../src/lib/phone.ts").catch(async () => {
  // Node sem remoção de tipos: cópia mínima não é aceitável; falha explícita.
  throw new Error("Rode com Node 23.6+ (remove tipos do .ts).");
});

const PHONE_CASES = [
  "21988880001", "(21) 98888-0001", "+55 (21) 98888-0001", "5521988880001", "021988880001", "+55 21 9 8888 0001",
  "2133330000", "(21) 3333-0000", "552133330000", "02133330000",
  "21888880001", "2193330000", "0198888000", "1198888000", "(00) 98888-0001", "219888800011", "abc",
  "", "  ", "+1 415 555 0000", "55 21 98888-0001 ramal 2", "55988880001", "5555988880001", "x".repeat(41),
];

await test("regra de telefone: TS e br_phone_key dão o mesmo resultado", async () => {
  for (const c of PHONE_CASES) {
    const { rows } = await pool.query("select public.br_phone_key($1) k", [c]);
    assert.equal(rows[0].k, phoneKey(c), JSON.stringify(c));
  }
});

await test("visitante e usuário comum não executam a RPC nem leem as tabelas novas", async () => {
  for (const role of ["anon", "authenticated"]) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await assert.rejects(
        c.query("select * from public.quick_queue_identify(null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1)"),
        /permission denied/
      );
      await c.query("rollback");
      for (const t of ["quick_queue_devices", "quick_queue_identify_attempts"]) {
        await c.query("begin");
        await c.query(`set local role ${role}`);
        await assert.rejects(c.query(`select * from public.${t}`), /permission denied/, `${role} ${t}`);
        await c.query("rollback");
      }
    } finally {
      c.release();
    }
  }
});

await test("telefone novo pede nome; com o nome cria convidado com origem e sem verificação", async () => {
  const t = await shop("novo");
  const d = newDevice();
  assert.equal(await identify(t, d, { phone: "21991110001" }), "NEED_NAME");
  assert.equal(await identify(t, d, { name: "Ana Teste" }), "CREATED");
  const { rows } = await pool.query(
    `select name, phone, phone_key, signup_origin, phone_verified_at, user_id from public.clients where tenant_id = $1`,
    [t]
  );
  assert.deepEqual(rows, [
    { name: "Ana Teste", phone: "(21) 99111-0001", phone_key: "21991110001", signup_origin: "QUICK_QUEUE", phone_verified_at: null, user_id: null },
  ]);
  const dev = await pool.query(`select client_id is not null as bound, pending_phone_key, pending_until from public.quick_queue_devices where token_hash = $1`, [d.current]);
  assert.deepEqual(dev.rows[0], { bound: true, pending_phone_key: null, pending_until: null });
});

await test("telefone já cadastrado (qualquer formato, ficha antiga sem chave) segue direto", async () => {
  const t = await shop("conhecido");
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Cliente Antigo Teste', '+55 (21) 98888-0002')`, [t]);
  const d = newDevice();
  assert.equal(await identify(t, d, { phone: "21988880002" }), "KNOWN");
  const { rows } = await pool.query(`select count(*)::int n from public.clients where tenant_id = $1`, [t]);
  assert.equal(rows[0].n, 1);
});

await test("ficha antiga gravada antes da chave existir também é encontrada (e ganha a chave)", async () => {
  const t = await shop("semchave");
  // Simula ficha anterior à schema-52: chave apagada como superusuário.
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Cliente Velho Teste', '21 98888-0003')`, [t]);
  await pool.query(`update public.clients set phone_key = null where tenant_id = $1`, [t]);
  // O gatilho recalcula phone_key só quando o telefone muda; aqui ela fica nula de propósito.
  const before = await pool.query(`select phone_key from public.clients where tenant_id = $1`, [t]);
  assert.equal(before.rows[0].phone_key, null);
  assert.equal(await identify(t, newDevice(), { phone: phoneKey("(21) 98888-0003") }), "KNOWN");
  const after = await pool.query(`select phone_key from public.clients where tenant_id = $1`, [t]);
  assert.equal(after.rows[0].phone_key, "21988880003");
});

await test("telefone que só existe em outra barbearia é tratado como novo", async () => {
  const a = await shop("a");
  const b = await shop("b");
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Cliente B Teste', '21977770002')`, [b]);
  assert.equal(await identify(a, newDevice(), { phone: "21977770002" }), "NEED_NAME");
});

await test("dois envios simultâneos do mesmo telefone e nome = um cliente só", async () => {
  const t = await shop("simultaneo");
  const devices = Array.from({ length: 10 }, newDevice);
  for (const d of devices) assert.equal(await identify(t, d, { phone: "21995550005" }), "NEED_NAME");
  // Sem o limite por telefone aqui: o teste é só de concorrência (o limite tem teste próprio).
  const results = await Promise.all(devices.map((d) => identify(t, d, { name: "Bruno Teste" }, { client: 100 })));
  assert.equal(results.filter((r) => r === "CREATED").length, 1, results.join(","));
  assert.ok(results.every((r) => r === "CREATED" || r === "KNOWN"), results.join(","));
  const { rows } = await pool.query(`select count(*)::int n from public.clients where tenant_id = $1`, [t]);
  assert.equal(rows[0].n, 1);
});

await test("mesmo número em formatos diferentes, ao mesmo tempo = um cliente só", async () => {
  const t = await shop("formatos");
  const formats = ["21994440004", "(21) 99444-0004", "+55 21 99444-0004", "021994440004"];
  const keys = formats.map(phoneKey);
  assert.ok(keys.every((k) => k === "21994440004"));
  const devices = formats.map(newDevice);
  for (const [i, d] of devices.entries()) await identify(t, d, { phone: keys[i] });
  await Promise.all(devices.map((d) => identify(t, d, { name: "Carla Teste" })));
  const { rows } = await pool.query(`select count(*)::int n from public.clients where tenant_id = $1`, [t]);
  assert.equal(rows[0].n, 1);
});

await test("passo do nome sem telefone antes, com credencial inventada ou de outra barbearia: NO_PENDING", async () => {
  const a = await shop("pend-a");
  const b = await shop("pend-b");
  assert.equal(await identify(a, { current: hash() }, { name: "Davi Teste" }), "NO_PENDING");
  const d = newDevice();
  await identify(a, d, { phone: "21993330003" });
  // Mesma credencial na barbearia B: não vale lá.
  assert.equal(await identify(b, { current: d.current }, { name: "Davi Teste" }), "NO_PENDING");
  const { rows } = await pool.query(`select count(*)::int n from public.clients where tenant_id = $1`, [b]);
  assert.equal(rows[0].n, 0);
});

await test("credencial de outra barbearia no passo do telefone não é reaproveitada: emite outra", async () => {
  const a = await shop("cred-a");
  const b = await shop("cred-b");
  const d = newDevice();
  await identify(a, d, { phone: "21992220002" });
  const fromA = d.current;
  const db = { current: fromA, fresh: hash() };
  await identify(b, db, { phone: "21992220002" });
  assert.notEqual(db.current, fromA);
});

await test("telefone deixado no passo do telefone vence e some", async () => {
  const t = await shop("vence");
  const d = newDevice();
  await identify(t, d, { phone: "21996660006" });
  await pool.query(`update public.quick_queue_devices set pending_until = now() - interval '1 second' where token_hash = $1`, [d.current]);
  assert.equal(await identify(t, d, { name: "Eva Teste" }), "NO_PENDING");
  const { rows } = await pool.query(`select count(*)::int n from public.quick_queue_devices where tenant_id = $1 and pending_phone_key is not null`, [t]);
  assert.equal(rows[0].n, 0);
});

await test("credencial vencida não vale", async () => {
  const t = await shop("expirada");
  const d = newDevice();
  await identify(t, d, { phone: "21997770007" });
  await pool.query(`update public.quick_queue_devices set expires_at = now() - interval '1 second' where token_hash = $1`, [d.current]);
  assert.equal(await identify(t, { current: d.current }, { name: "Fábio Teste" }), "NO_PENDING");
});

await test("nome inválido na função: recusado e nenhuma conta criada", async () => {
  const t = await shop("nome");
  for (const bad of ["A", "x".repeat(61), "Ana 2", "<b>Ana</b>", "ana@exemplo", "http://x"]) {
    const d = newDevice();
    await identify(t, d, { phone: "21998880008" });
    assert.equal(await identify(t, d, { name: bad }), "INVALID", bad);
  }
  const { rows } = await pool.query(`select count(*)::int n from public.clients where tenant_id = $1`, [t]);
  assert.equal(rows[0].n, 0);
});

await test("chave fora da regra é recusada mesmo vinda do servidor", async () => {
  const t = await shop("chave");
  assert.equal(await identify(t, newDevice(), { phone: "(21) 99999-0000" }), "INVALID");
  assert.equal(await identify(t, newDevice(), { phone: "5521999990000" }), "INVALID");
});

await test("fila rápida desligada: CLOSED, nada criado", async () => {
  const t = await shop("desligada", { quick: false });
  assert.equal(await identify(t, newDevice(), { phone: "21991119999" }), "CLOSED");
  const { rows } = await pool.query(`select count(*)::int n from public.quick_queue_devices where tenant_id = $1`, [t]);
  assert.equal(rows[0].n, 0);
});

await test("limite por aparelho: 5 tentativas na janela, a 6ª é recusada", async () => {
  const t = await shop("lim-dev");
  const d = newDevice();
  for (let i = 0; i < 5; i++) assert.notEqual(await identify(t, d, { phone: `2199000000${i}` }), "LIMIT");
  assert.equal(await identify(t, d, { phone: "21990000009" }), "LIMIT");
});

await test("limite por telefone conhecido: conta pelo cliente, mesmo trocando de aparelho", async () => {
  const t = await shop("lim-cli");
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Gabi Teste', '21989990001')`, [t]);
  for (let i = 0; i < 5; i++) assert.equal(await identify(t, newDevice(), { phone: "21989990001" }), "KNOWN");
  assert.equal(await identify(t, newDevice(), { phone: "21989990001" }), "LIMIT");
});

await test("teto de credenciais novas por barbearia por hora", async () => {
  const t = await shop("lim-cred");
  for (let i = 0; i < 3; i++) await identify(t, newDevice(), { phone: `2198800000${i}` }, { devicesHour: 3 });
  assert.equal(await identify(t, newDevice(), { phone: "21988000009" }, { devicesHour: 3 }), "TENANT_NEW_DEVICES"); // #148: resultado próprio (schema-64)
  // Aparelho que já tem credencial continua funcionando.
  const { rows } = await pool.query(`select token_hash from public.quick_queue_devices where tenant_id = $1 limit 1`, [t]);
  const again = await identify(t, { current: rows[0].token_hash }, { phone: "21988000008" }, { devicesHour: 3 });
  assert.ok(!["LIMIT", "TENANT_ATTEMPTS", "TENANT_NEW_DEVICES", "TENANT_NEW_CLIENTS"].includes(again), again);
});

await test("teto de tentativas por barbearia", async () => {
  const t = await shop("lim-ten");
  for (let i = 0; i < 4; i++) await identify(t, newDevice(), { phone: `2198700000${i}` }, { tenant: 4 });
  assert.equal(await identify(t, newDevice(), { phone: "21987000009" }, { tenant: 4 }), "TENANT_ATTEMPTS"); // #148: resultado próprio (schema-64)
});

await test("teto de contas novas por barbearia por dia", async () => {
  const t = await shop("lim-contas");
  for (let i = 0; i < 2; i++) {
    const d = newDevice();
    await identify(t, d, { phone: `2198600000${i}` });
    assert.equal(await identify(t, d, { name: "Hugo Teste" }, { clientsDay: 2 }), "CREATED");
  }
  const d = newDevice();
  await identify(t, d, { phone: "21986000009" });
  assert.equal(await identify(t, d, { name: "Hugo Teste" }, { clientsDay: 2 }), "TENANT_NEW_CLIENTS"); // #148: resultado próprio (schema-64)
});

await test("tentativas não guardam telefone; aparelho guarda só o resumo da credencial", async () => {
  const { rows } = await pool.query(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name in ('quick_queue_identify_attempts', 'quick_queue_devices')
      order by 1, 2`
  );
  const cols = rows.map((r) => `${r.table_name}.${r.column_name}`);
  assert.ok(!cols.some((c) => c.startsWith("quick_queue_identify_attempts.") && /phone|ip|name/.test(c)), cols.join(","));
  assert.ok(!cols.includes("quick_queue_devices.token"), "sem o valor da credencial");
});

await test("usuário comum não grava phone_key, origem nem verificação na própria ficha", async () => {
  const t = await shop("rls");
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Dona Do Numero Teste', '21985550001')`, [t]);
  const uid = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [uid, `rls-${RUN}@example.test`]
  );
  await pool.query(`insert into public.memberships (user_id, tenant_id, role) values ($1, $2, 'CLIENT')`, [uid, t]);
  const { rows: mine } = await pool.query(
    `insert into public.clients (tenant_id, user_id, name, phone) values ($1, $2, 'Invasor Teste', '21985550002') returning id`,
    [t, uid]
  );
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await c.query(
      `update public.clients set name = 'Invasor Mudou Teste', phone_key = '21985550001', signup_origin = 'QUICK_QUEUE', phone_verified_at = now() where id = $1`,
      [mine[0].id]
    );
    await c.query("commit");
  } finally {
    c.release();
  }
  const { rows } = await pool.query(`select name, phone_key, signup_origin, phone_verified_at from public.clients where id = $1`, [mine[0].id]);
  // O nome mudou (a atualização passou pela RLS); as colunas protegidas não.
  assert.deepEqual(rows[0], { name: "Invasor Mudou Teste", phone_key: "21985550002", signup_origin: null, phone_verified_at: null });
});

/** Usuário fictício com vínculo na barbearia; devolve o id. */
async function member(tenantId, role, label) {
  const uid = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [uid, `${label}-${RUN}@example.test`]
  );
  await pool.query(`insert into public.memberships (user_id, tenant_id, role) values ($1, $2, $3)`, [uid, tenantId, role]);
  return uid;
}

/** Roda sql como esse usuário (papel authenticated + jwt), como o PostgREST faz. */
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

await test("cliente logado troca o telefone para um número já usado na barbearia: sem erro, ficha sem chave", async () => {
  const t = await shop("perfil");
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Outro Cliente Teste', '21984440001')`, [t]);
  const uid = await member(t, "CLIENT", "perfil");
  const { rows: mine } = await pool.query(
    `insert into public.clients (tenant_id, user_id, name, phone) values ($1, $2, 'Cliente Perfil Teste', '21984440002') returning id`,
    [t, uid]
  );
  const r = await asUser(uid, `update public.clients set phone = '(21) 98444-0001' where id = $1`, [mine[0].id]);
  assert.equal(r.rowCount, 1, "a atualização passou pela RLS");
  let row = (await pool.query(`select phone, phone_key from public.clients where id = $1`, [mine[0].id])).rows[0];
  assert.deepEqual(row, { phone: "(21) 98444-0001", phone_key: null });
  // Número livre: ganha a chave. Mesma resposta (sem erro) nos dois casos.
  await asUser(uid, `update public.clients set phone = '(21) 98444-0003' where id = $1`, [mine[0].id]);
  row = (await pool.query(`select phone_key from public.clients where id = $1`, [mine[0].id])).rows[0];
  assert.equal(row.phone_key, "21984440003");
});

await test("admin da barbearia grava telefone repetido: ficha nova sem chave, sem erro", async () => {
  const t = await shop("admin");
  await pool.query(`insert into public.clients (tenant_id, name, phone) values ($1, 'Primeiro Teste', '21983330001')`, [t]);
  const uid = await member(t, "UNIT_ADMIN", "admin");
  await asUser(uid, `insert into public.clients (tenant_id, name, phone) values ($1, 'Segundo Teste', '+55 21 98333-0001')`, [t]);
  const { rows } = await pool.query(`select name, phone_key from public.clients where tenant_id = $1 order by created_at`, [t]);
  assert.deepEqual(rows, [
    { name: "Primeiro Teste", phone_key: "21983330001" },
    { name: "Segundo Teste", phone_key: null },
  ]);
});

await test("a função do gatilho não é chamável por visitante ou usuário comum", async () => {
  for (const role of ["anon", "authenticated"]) {
    const { rows } = await pool.query(`select has_function_privilege($1, 'public.clients_phone_key_sync()', 'execute') ok`, [role]);
    assert.equal(rows[0].ok, false, role);
  }
});

await test("telefone pendente vencido some mesmo com a fila rápida desligada", async () => {
  const t = await shop("pend-off");
  const d = newDevice();
  assert.equal(await identify(t, d, { phone: "21982220002" }), "NEED_NAME");
  await pool.query(`update public.quick_queue_devices set pending_until = now() - interval '1 second' where token_hash = $1`, [d.current]);
  await pool.query(`update public.tenants set quick_queue_enabled = false where id = $1`, [t]);
  assert.equal(await identify(t, newDevice(), { phone: "21982220003" }), "CLOSED");
  const { rows } = await pool.query(`select pending_phone_key, pending_until from public.quick_queue_devices where tenant_id = $1`, [t]);
  assert.deepEqual(rows, [{ pending_phone_key: null, pending_until: null }]);
});

await pool.end();
console.log(`\n${passed} testes de banco ok`);

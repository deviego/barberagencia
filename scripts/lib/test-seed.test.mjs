// Semeadura de teste, SEM banco: um `q` de mentira guarda as linhas em memória e registra todo SQL.
// Rodar: node --test scripts/lib/test-seed.test.mjs (não precisa de node_modules).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSeed, TENANTS, USERS } from "./test-seed.mjs";

/** Banco de mentira: entende só os formatos de SQL que a semeadura usa. */
function fakeDb() {
  const tables = {};
  const log = [];
  let seq = 0;
  const rows = (t) => (tables[t] ??= []);
  const q = async (sql, params = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    log.push(s);
    let m;
    if ((m = s.match(/^select (?:id|1) from public\.(\w+) where (\w+) = \$1(?: and (\w+) = \$2)?(?: and (\w+) = \$3)?$/))) {
      return rows(m[1]).filter((r) => r[m[2]] === params[0] && (!m[3] || r[m[3]] === params[1]) && (!m[4] || r[m[4]] === params[2]));
    }
    if ((m = s.match(/^insert into public\.(\w+) \(([^)]+)\) (values|select) /))) {
      const cols = m[2].split(",").map((c) => c.trim());
      const row = { id: `id-${++seq}` };
      cols.forEach((c, i) => (row[c] = params[i]));
      const t = rows(m[1]);
      const dupe =
        (/on conflict do nothing/.test(s) && t.some((r) => r.tenant_id === row.tenant_id)) ||
        (/where not exists/.test(s) && t.some((r) => r.tenant_id === row.tenant_id && (!("user_id" in row) || r.user_id === row.user_id)));
      if (!dupe) t.push(row);
      return /returning id/.test(s) ? [row] : [];
    }
    throw new Error(`SQL inesperado na semeadura: ${s}`);
  };
  return { q, tables, log };
}
const ensureUser = async (email) => ({ id: `user:${email}`, created: true });

test("só INSERT e SELECT: nenhum delete, update, truncate, drop ou alter", async () => {
  const db = fakeDb();
  await runSeed({ q: db.q, ensureUser });
  assert.ok(db.log.length > 20);
  for (const s of db.log) {
    assert.match(s, /^(insert into|select) /i, s);
    assert.doesNotMatch(s, /\b(delete|update|truncate|drop|alter)\b/i, s);
    assert.doesNotMatch(s, /on conflict .* do update/i, s);
  }
});

test("cria as 2 barbearias-base e os 3 distribuidores (ativo, pendente, suspenso)", async () => {
  const db = fakeDb();
  const out = await runSeed({ q: db.q, ensureUser });
  const bySub = Object.fromEntries(db.tables.tenants.map((t) => [t.subdomain, t]));
  assert.deepEqual(Object.keys(bySub).sort(), ["barbearia-teste", "distribuidor-ativo", "distribuidor-pendente", "distribuidor-suspenso", "plataforma-teste"]);
  for (const s of ["distribuidor-ativo", "distribuidor-pendente", "distribuidor-suspenso"]) {
    assert.equal(bySub[s].kind, "DISTRIBUTOR");
    assert.equal(bySub[s].saas_plan, "distribuidor");
  }
  assert.equal(bySub["distribuidor-ativo"].status, "ACTIVE");
  assert.equal(bySub["distribuidor-pendente"].status, "ACTIVE");
  assert.equal(bySub["distribuidor-suspenso"].status, "SUSPENDED");
  assert.equal(bySub["barbearia-teste"].kind, undefined); // usa o padrão do banco (barbearia)

  const contract = (key) => db.tables.tenant_contracts.find((c) => c.tenant_id === out.tenants[key]);
  assert.equal(contract("distAtivo").status, "SIGNED");
  assert.ok(contract("distAtivo").signed_at instanceof Date);
  assert.equal(contract("distPendente").status, "PENDING");
  assert.equal(contract("distPendente").signed_at, null);
  assert.equal(contract("distSuspenso").status, "SIGNED");
  assert.equal(db.tables.branding.length, 5);
  assert.equal(db.tables.tenant_settings.length, 5);
});

test("distribuidor ativo: 2 produtos e a Barbearia Teste na carteira; os outros dois, nada", async () => {
  const db = fakeDb();
  const { tenants } = await runSeed({ q: db.q, ensureUser });
  assert.deepEqual(db.tables.products.map((p) => [p.tenant_id, p.name]), [
    [tenants.distAtivo, "Pomada Modeladora Teste"],
    [tenants.distAtivo, "Óleo para Barba Teste"],
  ]);
  assert.equal(db.tables.distributor_customers.length, 1);
  assert.equal(db.tables.distributor_customers[0].tenant_id, tenants.distAtivo);
  assert.equal(db.tables.distributor_customers[0].customer_tenant_id, tenants.barbearia);
});

test("usuários: todos @example.test, um vínculo cada, no papel e na barbearia certos", async () => {
  const db = fakeDb();
  const asked = [];
  const { tenants, users } = await runSeed({ q: db.q, ensureUser: async (e) => (asked.push(e), { id: `user:${e}`, created: true }) });
  assert.deepEqual(asked, USERS.map((u) => u.email));
  for (const e of asked) assert.match(e, /@example\.test$/);
  assert.equal(db.tables.memberships.length, USERS.length);
  for (const u of USERS) {
    const m = db.tables.memberships.filter((x) => x.user_id === users[u.email]);
    assert.equal(m.length, 1);
    assert.equal(m[0].role, u.role);
    assert.equal(m[0].tenant_id, tenants[u.tenant]);
  }
  assert.equal(USERS.filter((u) => u.role === "MASTER").length, 1);
  assert.equal(db.tables.clients.length, 1);
  assert.equal(db.tables.clients[0].user_id, users["cliente@example.test"]);
  assert.equal(db.tables.barbers.length, 1);
  assert.equal(db.tables.working_hours.length, 6);
  assert.equal(db.tables.services.length, 1);
});

test("rodar duas vezes não duplica nada", async () => {
  const db = fakeDb();
  await runSeed({ q: db.q, ensureUser });
  const before = JSON.stringify(db.tables);
  await runSeed({ q: db.q, ensureUser });
  assert.equal(JSON.stringify(db.tables), before);
});

test("o módulo não traz senha nem chave", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./test-seed.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /password\s*[:=]|teste123|service_role|eyJ/i);
  assert.equal(Object.keys(TENANTS).length, 5);
});

test("guarda: recusa banco sem schema, com barbearia real ou com usuário real; aceita banco só com dados de teste", async () => {
  const { assertOnlyTestData } = await import("./test-seed.mjs");
  const fake = ({ ok = true, tenants = 0, users = 0 }) => {
    const seen = [];
    const q = async (sql, params) => {
      seen.push([sql, params]);
      if (/to_regclass/.test(sql)) return [{ ok }];
      if (/from public\.tenants/.test(sql)) return [{ n: tenants }];
      if (/from auth\.users/.test(sql)) return [{ n: users }];
      throw new Error(`SQL inesperado: ${sql}`);
    };
    return { q, seen };
  };
  await assert.rejects(assertOnlyTestData(fake({ ok: false }).q), /schema não está aplicado/);
  await assert.rejects(assertOnlyTestData(fake({ tenants: 2 }).q), /2 barbearia/);
  await assert.rejects(assertOnlyTestData(fake({ users: 1 }).q), /1 usuário/);
  const good = fake({});
  await assertOnlyTestData(good.q);
  for (const [sql] of good.seen) assert.match(sql, /^select /);
  assert.deepEqual(good.seen[1][1][0].sort(), Object.values(TENANTS).map((t) => t.subdomain).sort());
});

test("conta que já existia: sem vínculo e fora do arquivo de credenciais → aborta, nenhum vínculo para ela", async () => {
  for (const alvo of ["master@example.test", "dist.ativo@example.test"]) {
    const db = fakeDb();
    const ensure = async (email) => ({ id: `user:${email}`, created: email !== alvo, inCredsFile: false });
    await assert.rejects(runSeed({ q: db.q, ensureUser: ensure }), (e) => e.message.includes("ABORTADO") && e.message.includes(alvo));
    assert.equal((db.tables.memberships ?? []).filter((m) => m.user_id === `user:${alvo}`).length, 0);
    assert.equal((db.tables.memberships ?? []).some((m) => m.role === "MASTER" && alvo === "master@example.test"), false);
  }
});

test("conta que já existia com o vínculo em OUTRA barbearia ou com OUTRO papel → aborta", async () => {
  const alvo = "master@example.test";
  for (const errado of [{ tenant: "barbearia", role: "MASTER" }, { tenant: "plataforma", role: "CLIENT" }]) {
    const db = fakeDb();
    const first = await runSeed({ q: db.q, ensureUser }); // cria tudo
    const m = db.tables.memberships.find((x) => x.user_id === `user:${alvo}`);
    m.tenant_id = first.tenants[errado.tenant];
    m.role = errado.role;
    const before = JSON.stringify(db.tables.memberships);
    const ensure = async (email) => ({ id: `user:${email}`, created: false, inCredsFile: email !== alvo });
    await assert.rejects(runSeed({ q: db.q, ensureUser: ensure }), /ABORTADO/);
    assert.equal(JSON.stringify(db.tables.memberships), before);
  }
});

test("conta que já existia é reaproveitada se já tem o vínculo esperado ou se está no arquivo de credenciais", async () => {
  const db = fakeDb();
  await runSeed({ q: db.q, ensureUser });
  const before = JSON.stringify(db.tables);
  // já tem o vínculo esperado, fora do arquivo
  await runSeed({ q: db.q, ensureUser: async (email) => ({ id: `user:${email}`, created: false, inCredsFile: false }) });
  assert.equal(JSON.stringify(db.tables), before);
  // no arquivo, ainda sem vínculo (rodada anterior parou antes de gravar): completa o vínculo
  const db2 = fakeDb();
  await runSeed({ q: db2.q, ensureUser: async (email) => ({ id: `user:${email}`, created: false, inCredsFile: true }) });
  assert.equal(db2.tables.memberships.length, USERS.length);
});

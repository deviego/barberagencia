// Testes de banco da schema-66 (#177, #178): cadastro com contato, aceite de convite de uso único,
// cadastro comum sem ligar ficha existente e resolução só de contato confirmado.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Uso: DATABASE_URL=... SUPABASE_URL=http://127.0.0.1:<api> SUPABASE_SERVICE_ROLE_KEY=<da pilha local> \
//      node scripts/test-cadastro-contato-db.mjs
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
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
if (!["127.0.0.1", "localhost"].includes(new URL(process.env.SUPABASE_URL).hostname)) process.exit(1);
const pool = new pg.Pool({ ...localTarget(process.env.DATABASE_URL), max: 10 });
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RUN = randomBytes(3).toString("hex");
const sha = (v) => createHash("sha256").update(v).digest("hex");
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
const phone = () => `119${BASE + ++seq}`;
const mail = (t) => `cc-${RUN}-${t}-${randomBytes(2).toString("hex")}@example.test`;
const tech = (p) => `c${p}@cliente.barberagencia.app`;

async function shop(label) {
  const slug = `cc-${label}-${RUN}`;
  const { id } = await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind) values ($1, $2, 'essencial', 'BARBERSHOP') returning id`,
    [`Barbearia ${label} Teste`, slug]
  );
  return { id, slug };
}
/**
 * Cadastro como o servidor faz: conta nova (provider email; o trigger roda no insert) e depois
 * finalize_client_signup com o contato e o hash do convite. app = dados que o servidor passa.
 */
async function signup({ ph = phone(), app = {}, user = {} } = {}) {
  const id = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), $3, $4)`,
    [id, tech(ph), JSON.stringify({ provider: "email", providers: ["email"] }), JSON.stringify({ full_name: "Cliente Teste", phone: ph, ...user })]
  );
  const { r } = await one(`select public.finalize_client_signup($1, $2, $3) r`, [id, app.contact_email ?? null, app.invite_token_hash ?? null]);
  return { id, ph, r };
}
async function invite(s, { email = null, ph = null, expires = "7 days", status = "PENDING" } = {}) {
  const token = randomBytes(16).toString("hex");
  await pool.query(
    `insert into public.client_invites (tenant_id, token, name, email, phone, status, expires_at) values ($1, $2, 'Convidado Teste', $3, $4, $5, now() + $6::interval)`,
    [s.id, token, email, ph, status, expires]
  );
  const { id: cid } = await one(
    `insert into public.clients (tenant_id, name, email, phone, status) values ($1, 'Convidado Teste', $2, $3, 'INVITED') returning id`,
    [s.id, email, ph]
  );
  return { token, hash: sha(token), cid };
}
const clientsOf = (uid) => pool.query(`select * from public.clients where user_id = $1`, [uid]).then((r) => r.rows);
const membersOf = (uid) => pool.query(`select tenant_id, role from public.memberships where user_id = $1`, [uid]).then((r) => r.rows);
const clientRow = (id) => one(`select * from public.clients where id = $1`, [id]);

const A = await shop("a");
const B = await shop("b");

// ---- Auth de verdade (API local) -----------------------------------------------------------------
await test("Auth local: conta criada pela API (e-mail técnico) + finalização gravam o contato no perfil e na ficha", async () => {
  const ph = phone();
  const contact = mail("api");
  const { data, error } = await service.auth.admin.createUser({
    email: tech(ph),
    password: "senha-forte-123",
    email_confirm: true,
    user_metadata: { full_name: "Api Teste", phone: ph, tenant_subdomain: A.slug },
  });
  assert.ifError(error);
  const u = await one(`select email, raw_app_meta_data from auth.users where id = $1`, [data.user.id]);
  assert.equal(u.email, tech(ph));
  assert.equal(u.raw_app_meta_data.provider, "email");
  const [c0] = await clientsOf(data.user.id);
  assert.equal(c0.email, null, "e-mail técnico não vira e-mail da ficha");
  assert.equal((await one(`select public.finalize_client_signup($1, $2, null) r`, [data.user.id, contact])).r, "OK");
  const p = await one(`select contact_email, contact_email_verified_at from public.profiles where id = $1`, [data.user.id]);
  assert.deepEqual(p, { contact_email: contact, contact_email_verified_at: null });
  const [c] = await clientsOf(data.user.id);
  assert.equal(c.email, contact);
  assert.equal(c.tenant_id, A.id);
});

// ---- Cadastro comum ----------------------------------------------------------------------------------
await test("cadastro comum com o e-mail e o telefone de um convidado: ficha NOVA; convidado intacto", async () => {
  const em = mail("conv");
  const ph = phone();
  const inv = await invite(A, { email: em, ph });
  const { id } = await signup({ ph, app: { contact_email: em }, user: { tenant_subdomain: A.slug } });
  const mine = await clientsOf(id);
  assert.equal(mine.length, 1);
  assert.notEqual(mine[0].id, inv.cid);
  const c = await clientRow(inv.cid);
  assert.deepEqual([c.user_id, c.status], [null, "INVITED"]);
  assert.equal((await one(`select status from public.client_invites where token = $1`, [inv.token])).status, "PENDING");
});

await test("finalização: só conta de e-mail recém-criada; contato técnico ou inválido não é gravado", async () => {
  const old = await signup();
  await pool.query(`update auth.users set created_at = now() - interval '2 hours' where id = $1`, [old.id]);
  assert.equal((await one(`select public.finalize_client_signup($1, $2, null) r`, [old.id, mail("x")])).r, "INVALID");
  const g = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), $3, '{}')`,
    [g, mail("g"), JSON.stringify({ provider: "google", providers: ["google"] })]
  );
  assert.equal((await one(`select public.finalize_client_signup($1, $2, null) r`, [g, mail("x")])).r, "INVALID");
  for (const bad of ["c1@cliente.barberagencia.app", "nao-e-email"]) {
    const n = await signup({ app: { contact_email: bad } });
    assert.equal((await one(`select contact_email from public.profiles where id = $1`, [n.id])).contact_email, null, bad);
  }
});

await test("dados de vínculo escritos pelo USUÁRIO (user_metadata) não valem", async () => {
  const inv = await invite(A, { email: mail("um") });
  const { id } = await signup({ user: { tenant_subdomain: B.slug, invite_token_hash: inv.hash, contact_email: mail("x") } }); // nada pelo servidor
  assert.equal((await clientRow(inv.cid)).status, "INVITED");
  assert.equal((await one(`select contact_email from public.profiles where id = $1`, [id])).contact_email, null);
  assert.deepEqual((await membersOf(id)).map((m) => m.tenant_id), [B.id]);
});

// ---- Aceite de convite -----------------------------------------------------------------------------
await test("convite válido (e-mail): liga a ficha convidada, marca o convite como aceito", async () => {
  const em = mail("ok");
  const inv = await invite(A, { email: em });
  const { id } = await signup({ app: { invite_token_hash: inv.hash, contact_email: em } });
  const c = await clientRow(inv.cid);
  assert.deepEqual([c.user_id, c.status], [id, "ACTIVE"]);
  assert.deepEqual(await membersOf(id), [{ tenant_id: A.id, role: "CLIENT" }]);
  assert.equal((await one(`select status from public.client_invites where token = $1`, [inv.token])).status, "ACCEPTED");
});

await test("convite válido (só telefone): liga pela chave do telefone do convite", async () => {
  const ph = phone();
  const inv = await invite(A, { ph });
  const { id } = await signup({ app: { invite_token_hash: inv.hash } });
  assert.equal((await clientRow(inv.cid)).user_id, id);
});

await test("barbearia vem do convite: conta que já nasceu com barbearia não aceita convite (nada muda)", async () => {
  const em = mail("loja");
  const inv = await invite(A, { email: em });
  const { id, r } = await signup({ app: { invite_token_hash: inv.hash, contact_email: em }, user: { tenant_subdomain: B.slug } });
  assert.equal(r, "INVALID");
  assert.deepEqual((await membersOf(id)).map((m) => m.tenant_id), [B.id]);
  assert.equal((await clientRow(inv.cid)).user_id, null);
  assert.equal((await one(`select status from public.client_invites where token = $1`, [inv.token])).status, "PENDING");
  // Fluxo do servidor (sem barbearia no cadastro): liga na barbearia do convite.
  const ok = await signup({ app: { invite_token_hash: inv.hash, contact_email: em } });
  assert.equal(ok.r, "OK");
  assert.deepEqual((await membersOf(ok.id)).map((m) => m.tenant_id), [A.id]);
});

await test("convite vencido, já aceito ou com hash errado: INVITE_INVALID, só o perfil, nada ligado", async () => {
  const cases = [
    async () => (await invite(A, { email: mail("venc"), expires: "-1 minute" })),
    async () => (await invite(A, { email: mail("aceito"), status: "ACCEPTED" })),
    async () => ({ ...(await invite(A, { email: mail("hash") })), hash: sha("outro") }),
  ];
  for (const make of cases) {
    const inv = await make();
    const { id, r } = await signup({ app: { invite_token_hash: inv.hash } });
    assert.equal(r, "INVITE_INVALID");
    assert.equal((await clientsOf(id)).length, 0);
    assert.equal((await membersOf(id)).length, 0);
    assert.equal((await clientRow(inv.cid)).user_id, null);
  }
});

await test("convite usado uma vez só (em série)", async () => {
  const inv = await invite(A, { email: mail("serie") });
  const first = await signup({ app: { invite_token_hash: inv.hash } });
  const second = await signup({ app: { invite_token_hash: inv.hash } });
  assert.equal((await clientRow(inv.cid)).user_id, first.id);
  assert.equal((await membersOf(second.id)).length, 0);
});

await test("dois cadastros SIMULTÂNEOS com o mesmo convite: só um liga", async () => {
  const inv = await invite(A, { email: mail("conc") });
  const res = await Promise.all(Array.from({ length: 8 }, () => signup({ app: { invite_token_hash: inv.hash } })));
  const linked = [];
  for (const r of res) if ((await membersOf(r.id)).length) linked.push(r.id);
  assert.equal(linked.length, 1);
  assert.equal((await clientRow(inv.cid)).user_id, linked[0]);
});

await test("convite sem ficha convidada correspondente: cria ficha nova na barbearia do convite", async () => {
  const token = randomBytes(16).toString("hex");
  await pool.query(
    `insert into public.client_invites (tenant_id, token, email, status, expires_at) values ($1, $2, $3, 'PENDING', now() + interval '1 day')`,
    [A.id, token, mail("semficha")]
  );
  const { id } = await signup({ app: { invite_token_hash: sha(token) } });
  const mine = await clientsOf(id);
  assert.deepEqual([mine.length, mine[0].tenant_id, mine[0].status], [1, A.id, "ACTIVE"]);
});

// ---- Contato confirmado e resolução ---------------------------------------------------------------
await test("resolução: só contato CONFIRMADO; ambíguo (2 contas) não resolve", async () => {
  const em = mail("res");
  const a = await signup({ app: { contact_email: em }, user: { tenant_subdomain: A.slug } });
  const r = (e) => one(`select public.auth_email_for_contact_email($1) v`, [e]).then((x) => x.v);
  assert.equal(await r(em), null, "não confirmado");
  await pool.query(`update public.profiles set contact_email_verified_at = now() where id = $1`, [a.id]);
  assert.equal(await r(em.toUpperCase()), tech(a.ph));
  const b = await signup({ app: { contact_email: em }, user: { tenant_subdomain: B.slug } });
  assert.equal(await r(em), tech(a.ph), "segundo ainda não confirmado: não conta");
  await pool.query(`update public.profiles set contact_email_verified_at = now() where id = $1`, [b.id]);
  assert.equal(await r(em), null, "dois confirmados: não resolve");
});

await test("permissões: anon e authenticated não executam a resolução nem a finalização, nem leem as confirmações", async () => {
  for (const role of ["anon", "authenticated"]) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await assert.rejects(c.query(`select public.auth_email_for_contact_email('x@example.test')`), (e) => e.code === "42501");
      await c.query("rollback");
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await assert.rejects(c.query(`select public.finalize_client_signup(gen_random_uuid(), null, null)`), (e) => e.code === "42501");
      await c.query("rollback");
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await assert.rejects(c.query(`select * from public.contact_email_confirmations`), (e) => e.code === "42501");
    } finally {
      await c.query("rollback").catch(() => {});
      c.release();
    }
  }
  const rls = await one(`select relrowsecurity from pg_class where oid = 'public.contact_email_confirmations'::regclass`);
  assert.equal(rls.relrowsecurity, true);
});

await test("ramo do Google (schema-65) igual: só perfil, sem ficha", async () => {
  const id = randomUUID();
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), $3, $4)`,
    [id, mail("g"), JSON.stringify({ provider: "google", providers: ["google"] }), JSON.stringify({ full_name: "Google Teste", tenant_subdomain: A.slug })]
  );
  assert.equal((await clientsOf(id)).length, 0);
});

await test("migration 66 re-executável", async () => {
  const sql = readFileSync(new URL("../supabase/schema-66-cadastro-contato-convite.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(sql);
});

await pool.end();
console.log(`\n${passed} testes ok`);

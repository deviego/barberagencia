// Testes de banco do #169 (ADR 0005): com o handle_new_user em vigor (schema-invite-fix), conta nova
// no formato do Google (metadados do provedor, sem barbearia) nasce só com o perfil; contas de
// e-mail (telefone + senha, e-mail + senha, convite) seguem como hoje. Sem migration nova.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Cada execução cria barbearias e usuários novos com sufixo aleatório e não apaga nada.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-auth-provider-db.mjs
import { randomBytes, randomUUID } from "node:crypto";
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
const mail = (tag) => `ap-${RUN}-${tag}-${randomBytes(2).toString("hex")}@example.test`;

async function shop(label) {
  const slug = `ap-${label}-${RUN}`;
  const { id } = await one(
    `insert into public.tenants (name, subdomain, saas_plan, kind) values ($1, $2, 'essencial', 'BARBERSHOP') returning id`,
    [`Barbearia ${label} Teste`, slug]
  );
  return { id, slug };
}

/** Cria o usuário como o Supabase Auth faz (insert em auth.users; o trigger roda). */
async function newUser({ provider, email = mail("u"), userMeta = {} }) {
  const id = randomUUID();
  const app = provider === null ? null : { provider, providers: [provider] };
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), $3, $4)`,
    [id, email, app ? JSON.stringify(app) : null, JSON.stringify(userMeta)]
  );
  return id;
}
const profile = (id) => one(`select full_name, phone from public.profiles where id = $1`, [id]);
const counts = async (id) => ({
  clients: (await one(`select count(*)::int n from public.clients where user_id = $1`, [id])).n,
  memberships: (await one(`select count(*)::int n from public.memberships where user_id = $1`, [id])).n,
});

const S = await shop("a");

/** Metadados como o Supabase Auth grava para uma conta nova do Google (sem barbearia, sem telefone). */
const googleMeta = (name, email) => ({
  iss: "https://accounts.google.com",
  sub: String(Date.now()) + randomBytes(3).toString("hex"),
  name,
  full_name: name,
  email,
  email_verified: true,
  picture: "https://example.test/foto.png",
  avatar_url: "https://example.test/foto.png",
  provider_id: "x",
});

// ---- Conta no formato do Google ------------------------------------------------------------------
await test("Google: nasce só com o perfil (nome); sem cliente, sem vínculo, sem barbearia", async () => {
  const email = mail("g");
  const id = await newUser({ provider: "google", email, userMeta: googleMeta("Ana Teste", email) });
  assert.deepEqual(await profile(id), { full_name: "Ana Teste", phone: null });
  assert.deepEqual(await counts(id), { clients: 0, memberships: 0 });
});

await test("Google com o mesmo e-mail de um convite pendente: o convite NÃO é ligado", async () => {
  const email = mail("convite");
  const { id: inviteId } = await one(
    `insert into public.clients (tenant_id, name, email, status) values ($1, 'Convidado Teste', $2, 'INVITED') returning id`,
    [S.id, email]
  );
  const id = await newUser({ provider: "google", email, userMeta: googleMeta("Convidado Teste", email) });
  const c = await one(`select user_id, status from public.clients where id = $1`, [inviteId]);
  assert.deepEqual(c, { user_id: null, status: "INVITED" });
  assert.deepEqual(await counts(id), { clients: 0, memberships: 0 });
});

// ---- E-mail: como hoje --------------------------------------------------------------------------
await test("e-mail com barbearia: cria cliente e vínculo CLIENT como hoje", async () => {
  const id = await newUser({ provider: "email", userMeta: { full_name: "Davi Teste", phone: "11987650002", tenant_subdomain: S.slug } });
  assert.deepEqual(await counts(id), { clients: 1, memberships: 1 });
  const c = await one(`select tenant_id, name, phone, status from public.clients where user_id = $1`, [id]);
  assert.deepEqual(c, { tenant_id: S.id, name: "Davi Teste", phone: "11987650002", status: "ACTIVE" });
  assert.equal((await one(`select role from public.memberships where user_id = $1`, [id])).role, "CLIENT");
  assert.deepEqual(await profile(id), { full_name: "Davi Teste", phone: "11987650002" });
});

await test("e-mail que bate com convite pendente: liga o convite como hoje", async () => {
  const email = mail("convite2");
  const { id: inviteId } = await one(
    `insert into public.clients (tenant_id, name, email, status) values ($1, 'Eva Teste', $2, 'INVITED') returning id`,
    [S.id, email]
  );
  const id = await newUser({ provider: "email", email, userMeta: { full_name: "Eva Teste", tenant_subdomain: S.slug } });
  const c = await one(`select user_id, status from public.clients where id = $1`, [inviteId]);
  assert.deepEqual(c, { user_id: id, status: "ACTIVE" });
});

await test("e-mail sem barbearia: só o perfil, como hoje", async () => {
  const id = await newUser({ provider: "email", userMeta: { full_name: "Fabi Teste" } });
  assert.deepEqual(await counts(id), { clients: 0, memberships: 0 });
});

await test("conta sem provedor nos metadados, com barbearia: cliente criado (como hoje)", async () => {
  const id = await newUser({ provider: null, userMeta: { full_name: "Gui Teste", tenant_subdomain: S.slug } });
  assert.deepEqual(await counts(id), { clients: 1, memberships: 1 });
});

// ---- Estrutura ---------------------------------------------------------------------------------
await test("trigger segue ligado; função security definer com search_path fixo", async () => {
  const t = await one(
    `select tgenabled from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass`
  );
  assert.ok(t && t.tgenabled !== "D");
  const f = await one(
    `select p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user'`
  );
  assert.equal(f.prosecdef, true);
  assert.ok(f.proconfig.some((c) => c.startsWith("search_path=")));
});

await pool.end();
console.log(`\n${passed} testes ok`);

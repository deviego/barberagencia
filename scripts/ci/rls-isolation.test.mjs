// Teste de isolamento entre barbearias (RLS) contra o Supabase LOCAL do `supabase start`.
// Dois tenants FICTÍCIOS, um dono (UNIT_ADMIN) em cada, logados com JWT de verdade (GoTrue local).
// O dono A não pode ler, inserir, alterar nem apagar dados do tenant B (e vice-versa).
//
// Uso (as chaves locais vêm de `supabase status -o env`, nunca de produção):
//   eval "$(npx supabase status -o env | sed 's/^/export /')"
//   node --test scripts/ci/rls-isolation.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) throw new Error("Faltam ANON_KEY/SERVICE_ROLE_KEY (rode `supabase status -o env`).");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_)) throw new Error(`Só roda em Supabase local, não em ${URL_}`);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const run = randomUUID().slice(0, 8);
const shops = {}; // { A: { tenantId, userId, db, clientId }, B: {...} }

async function makeShop(label) {
  const { data: t, error: te } = await admin
    .from("tenants")
    .insert({ name: `Barbearia Teste ${label} ${run}`, subdomain: `teste-${label.toLowerCase()}-${run}` })
    .select("id")
    .single();
  if (te) throw te;
  const email = `dono-${label.toLowerCase()}-${run}@example.test`;
  const password = `senha-teste-${run}`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ue) throw ue;
  const { error: me } = await admin.from("memberships").insert({ user_id: u.user.id, tenant_id: t.id, role: "UNIT_ADMIN" });
  if (me) throw me;
  const { data: c, error: ce } = await admin
    .from("clients")
    .insert({ tenant_id: t.id, name: `Cliente Fictício ${label}` })
    .select("id")
    .single();
  if (ce) throw ce;
  // Login de verdade → JWT `authenticated` com o uid do dono.
  const db = createClient(URL_, ANON, opts);
  const { error: se } = await db.auth.signInWithPassword({ email, password });
  if (se) throw se;
  return { tenantId: t.id, userId: u.user.id, db, clientId: c.id };
}

before(async () => {
  shops.A = await makeShop("A");
  shops.B = await makeShop("B");
});

after(async () => {
  for (const s of Object.values(shops)) {
    await admin.from("tenants").delete().eq("id", s.tenantId);
    await admin.auth.admin.deleteUser(s.userId);
  }
});

for (const [me, other] of [["A", "B"], ["B", "A"]]) {
  test(`dono ${me} só lê clientes do próprio tenant`, async () => {
    const { data, error } = await shops[me].db.from("clients").select("id, tenant_id");
    assert.ifError(error);
    assert.ok(data.length >= 1, "deveria ver os próprios clientes");
    assert.ok(data.every((r) => r.tenant_id === shops[me].tenantId), "viu cliente de outro tenant");
  });

  test(`dono ${me} não lê clientes do tenant ${other} nem filtrando pelo id`, async () => {
    const { data, error } = await shops[me].db.from("clients").select("id").eq("tenant_id", shops[other].tenantId);
    assert.ifError(error);
    assert.equal(data.length, 0);
  });

  test(`dono ${me} não insere cliente no tenant ${other}`, async () => {
    const { error } = await shops[me].db.from("clients").insert({ tenant_id: shops[other].tenantId, name: "Intruso" });
    assert.ok(error, "insert cross-tenant deveria ser bloqueado pela RLS");
  });

  test(`dono ${me} não altera nem apaga cliente do tenant ${other}`, async () => {
    const upd = await shops[me].db.from("clients").update({ name: "Alterado" }).eq("id", shops[other].clientId).select("id");
    assert.equal(upd.data?.length ?? 0, 0, "update cross-tenant afetou linha");
    const del = await shops[me].db.from("clients").delete().eq("id", shops[other].clientId).select("id");
    assert.equal(del.data?.length ?? 0, 0, "delete cross-tenant afetou linha");
    const { data } = await admin.from("clients").select("name").eq("id", shops[other].clientId).single();
    assert.equal(data.name, `Cliente Fictício ${other}`);
  });

  test(`dono ${me} não lê o tenant ${other} (tenants/memberships)`, async () => {
    const t = await shops[me].db.from("tenants").select("id").eq("id", shops[other].tenantId);
    assert.equal(t.data?.length ?? 0, 0);
    const m = await shops[me].db.from("memberships").select("user_id").eq("tenant_id", shops[other].tenantId);
    assert.equal(m.data?.length ?? 0, 0);
  });
}

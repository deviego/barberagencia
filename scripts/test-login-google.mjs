// Testes do "Entrar com Google" (#170), sem rede e sem banco: o callback do cliente, a ação
// confirmWhatsapp e a leitura getPendingAccount rodam de verdade com dublês de sessão, banco,
// cookies e NextResponse. Dados fictícios.
// Roda com: node scripts/test-login-google.mjs
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

// Estado do teste: globalThis.__g. Banco = tabelas em memória; sessão = usuário atual.
const FAKE_DB = `
const g = () => globalThis.__g;
const match = (r, f) => Object.entries(f).every(([k, v]) => r[k] === v);
function from(table) {
  const q = { table, f: {}, op: "select", values: null, opts: null, head: false };
  const rows = () => (g().db[table] ??= []);
  const run = () => {
    const d = g();
    d.ops.push(table + ":" + q.op);
    if (d.fail?.includes(table + ":" + q.op)) return { data: null, error: { code: "XX000" }, count: null };
    if (q.op === "insert") { rows().push({ ...q.values }); d.writes.push({ table, op: "insert", values: q.values }); return { data: null, error: null }; }
    if (q.op === "upsert") {
      const keys = (q.opts?.onConflict ?? "").split(",");
      const found = rows().find((r) => keys.every((k) => r[k] === q.values[k]));
      if (!found) rows().push({ ...q.values });
      d.writes.push({ table, op: "upsert", values: q.values });
      return { data: null, error: null };
    }
    if (q.op === "update") {
      const hit = rows().filter((r) => match(r, q.f));
      hit.forEach((r) => Object.assign(r, q.values));
      d.writes.push({ table, op: "update", values: q.values, f: { ...q.f } });
      return { data: hit, error: null };
    }
    const hit = rows().filter((r) => match(r, q.f));
    return { data: hit, error: null, count: hit.length };
  };
  const api = {
    select(_c, o) { q.head = !!o?.head; return api; },
    eq(c, v) { q.f[c] = v; return api; },
    limit() { return api; },
    insert(v) { q.op = "insert"; q.values = v; return api; },
    upsert(v, o) { q.op = "upsert"; q.values = v; q.opts = o; return api; },
    update(v) { q.op = "update"; q.values = v; return api; },
    async maybeSingle() { const r = run(); return r.error ? r : { data: (r.data ?? [])[0] ?? null, error: null }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
async function rpc(fn, args) {
  const d = g();
  d.rpcs.push({ fn, args });
  if (fn === "rate_limit_hit") return { data: d.rateOk !== false, error: null };
  if (fn === "auth_email_for_phone") return { data: d.phoneAccounts?.[args.p_digits] ?? null, error: null };
  return { data: null, error: { code: "PGRST202" } };
}
const auth = {
  async getUser() { return { data: { user: g().user } }; },
  async exchangeCodeForSession(code) {
    g().exchanged = code;
    return g().exchangeError ? { data: {}, error: { message: "x" } } : { data: { user: g().user }, error: null };
  },
  async signOut() { g().signedOut = true; return { error: null }; },
};
export function createSupabaseAdminClient() { return { from, rpc }; }
export async function createSupabaseServerClient() { return { from, rpc, auth }; }
export function createServerClient(_u, _k, opts) { globalThis.__g.areaCookie = opts.cookieOptions; return { from, rpc, auth }; }
`;
const FAKES = {
  "server-only": "",
  react: "export const cache = (f) => f;",
  "@/lib/supabase/admin": FAKE_DB,
  "@/lib/supabase/server": FAKE_DB,
  "@supabase/ssr": FAKE_DB,
  "@/lib/supabase/env": "export function supabasePublicEnv() { return { url: 'http://localhost', anonKey: 'x' }; }",
  "next/headers": `export async function cookies() {
    const c = globalThis.__g.cookies;
    return { get: (n) => (c.has(n) ? { name: n, value: c.get(n) } : undefined), getAll: () => [...c].map(([name, value]) => ({ name, value })),
             set: (n, v) => c.set(n, v), delete: (n) => { c.delete(n); globalThis.__g.deleted.push(n); } };
  }
  export async function headers() { return new Map(); }`,
  "next/server": "export const NextResponse = { redirect(url) { return { redirect: String(url) }; } };",
  "@/lib/tenant/resolve": "export const TENANT_COOKIE = 'bb_tenant';",
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier in FAKES) return { url: "data:text/javascript," + encodeURIComponent(FAKES[specifier]), shortCircuit: true };
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") && context.parentURL.endsWith(".ts")) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target && !existsSync(target)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
    }
    if (target && existsSync(target)) return next(pathToFileURL(target).href, context);
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

const callback = await import(pathToFileURL(path.join(SRC, "app/client/auth/callback/route.ts")).href);
const { confirmWhatsapp } = await import("@/features/auth/google-actions");
const { getPendingAccount, getMyLoginMethods } = await import("@/features/auth/google-data");
const { GOOGLE_LOGIN_MESSAGES: MSG } = await import("@/features/auth/google-types");

const SHOP = "00000000-0000-4000-8000-00000000000a";
const USER = "00000000-0000-4000-8000-0000000000u1".replace("u", "a");
const O = "https://www.example.test";

function reset(over = {}) {
  globalThis.__g = {
    user: { id: USER, email: "ana@example.test", user_metadata: { full_name: "Ana Teste" }, identities: [{ provider: "google" }] },
    cookies: new Map([["bb_tenant", "barbearia-a"]]),
    deleted: [],
    db: {
      memberships: [],
      clients: [],
      profiles: [{ id: USER }],
      tenants: [{ id: SHOP, name: "Barbearia A Teste", subdomain: "barbearia-a", kind: "BARBERSHOP", status: "ACTIVE" }],
      branding: [{ tenant_id: SHOP, logo_text: "BA", logo_url: null, accent: "#123456" }],
    },
    ops: [],
    writes: [],
    rpcs: [],
    ...over,
  };
  return globalThis.__g;
}
const cb = (qs) => callback.GET(new Request(`${O}/client/auth/callback?${qs}`));

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

// ---- Callback -------------------------------------------------------------------------------------
await test("callback: conta nova (sem vínculo) com barbearia válida vai para confirmar WhatsApp, ignorando next", async () => {
  const g = reset();
  assert.equal((await cb("code=abc&next=/client/agendar")).redirect, `${O}/client/confirmar-whatsapp`);
  assert.equal(g.exchanged, "abc");
});

await test("callback: sessão sempre no cookie da área do cliente; 'ver como cliente' é desligado", async () => {
  const g = reset();
  g.cookies.set("bb_view_as_client", "1");
  await cb("code=abc");
  assert.deepEqual([g.areaCookie.name, g.areaCookie.path], ["sb-cli", "/client"]);
  assert.ok(g.deleted.includes("bb_view_as_client"));
});

await test("callback: conta nova sem barbearia válida sai da sessão e volta ao login (google_sem_barbearia)", async () => {
  for (const setup of [
    (g) => g.cookies.delete("bb_tenant"),
    (g) => g.cookies.set("bb_tenant", "nao-existe"),
    (g) => (g.db.tenants[0].status = "SUSPENDED"),
    (g) => (g.db.tenants[0].kind = "DISTRIBUTOR"),
    (g) => g.cookies.set("bb_tenant", "../x"),
  ]) {
    const g = reset();
    setup(g);
    assert.equal((await cb("code=abc")).redirect, `${O}/client/login?error=google_sem_barbearia`);
    assert.equal(g.signedOut, true);
  }
});

await test("callback: conta que já é cliente segue para o next, só dentro da área", async () => {
  const g = reset();
  g.db.memberships.push({ user_id: USER, tenant_id: SHOP, role: "CLIENT" });
  assert.equal((await cb("code=abc&next=/client/agendar")).redirect, `${O}/client/agendar`);
  reset().db.memberships.push({ user_id: USER, tenant_id: SHOP, role: "CLIENT" });
  assert.equal((await cb("code=abc&next=//example.test")).redirect, `${O}/client`);
  reset().db.memberships.push({ user_id: USER, tenant_id: SHOP, role: "CLIENT" });
  assert.equal((await cb("code=abc")).redirect, `${O}/client`);
});

await test("callback: erros vão para os códigos do contrato, sem texto do provedor", async () => {
  reset();
  assert.equal((await cb("error=access_denied&error_description=<b>x</b>")).redirect, `${O}/client/login?error=google_cancelado`);
  assert.equal((await cb("error=server_error&error_code=identity_already_exists")).redirect, `${O}/client/perfil?error=conta_vinculada_outra`);
  assert.equal((await cb("")).redirect, `${O}/client/login?error=auth`);
  reset({ exchangeError: true });
  assert.equal((await cb("code=abc")).redirect, `${O}/client/login?error=auth`);
  const g = reset({ fail: ["memberships:select"] });
  assert.equal((await cb("code=abc")).redirect, `${O}/client/login?error=auth`);
  assert.ok(!g.writes.length);
});

// ---- confirmWhatsapp -----------------------------------------------------------------------------
await test("confirmar: cria ficha e vínculo CLIENT na barbearia do cookie, com dados da sessão", async () => {
  const g = reset();
  assert.deepEqual(await confirmWhatsapp({ phone: "(11) 98765-0001" }), { ok: true, next: "/client" });
  const c = g.db.clients[0];
  assert.deepEqual(
    { t: c.tenant_id, u: c.user_id, n: c.name, e: c.email, p: c.phone, s: c.status },
    { t: SHOP, u: USER, n: "Ana Teste", e: "ana@example.test", p: "(11) 98765-0001", s: "ACTIVE" }
  );
  assert.deepEqual(g.db.memberships, [{ user_id: USER, tenant_id: SHOP, role: "CLIENT" }]);
  assert.equal(g.db.profiles[0].phone, "(11) 98765-0001");
});

await test("confirmar: telefone que já tem conta → NEEDS_PROOF, nada criado", async () => {
  const g = reset({ phoneAccounts: { "11987650002": "c11987650002@cliente.barberagencia.app" } });
  assert.deepEqual(await confirmWhatsapp({ phone: "11987650002" }), { ok: false, code: "NEEDS_PROOF", error: MSG.needsProof });
  assert.equal(g.db.clients.length + g.db.memberships.length, 0);
});

await test("confirmar: ficha da barbearia com o mesmo telefone (convite sem conta) não é assumida → NEEDS_PROOF", async () => {
  const g = reset();
  g.db.clients.push({ id: "c-convite", tenant_id: SHOP, user_id: null, phone_key: "11987650003", status: "INVITED" });
  assert.equal((await confirmWhatsapp({ phone: "11987650003" })).code, "NEEDS_PROOF");
  assert.equal(g.db.clients.length, 1);
  assert.equal(g.db.clients[0].user_id, null);
  assert.equal(g.db.memberships.length, 0);
});

await test("confirmar: telefone inválido, sem sessão, limite e sem barbearia", async () => {
  let g = reset();
  for (const v of ["", "123", "abc", "1198765", "x".repeat(50)]) {
    assert.equal((await confirmWhatsapp({ phone: v })).code, "INVALID_PHONE", v);
  }
  assert.equal(g.rpcs.length, 0, "telefone inválido não chega ao banco");
  g = reset({ user: null });
  assert.equal((await confirmWhatsapp({ phone: "11987650004" })).code, "NOT_SIGNED_IN");
  g = reset({ rateOk: false });
  assert.equal((await confirmWhatsapp({ phone: "11987650004" })).code, "LIMIT");
  g = reset();
  g.cookies.delete("bb_tenant");
  assert.equal((await confirmWhatsapp({ phone: "11987650004" })).code, "NO_SHOP");
  assert.equal(g.db.clients.length + g.db.memberships.length, 0);
});

await test("confirmar: quem já é cliente recebe ok sem criar nada de novo", async () => {
  const g = reset();
  g.db.memberships.push({ user_id: USER, tenant_id: SHOP, role: "CLIENT" });
  assert.deepEqual(await confirmWhatsapp({ phone: "11987650005" }), { ok: true, next: "/client" });
  assert.equal(g.db.clients.length, 0);
});

await test("confirmar: tentativa que parou no meio reaproveita a ficha (sem duplicar)", async () => {
  const g = reset({ fail: ["memberships:upsert"] });
  assert.equal((await confirmWhatsapp({ phone: "11987650006" })).code, "GENERIC");
  assert.equal(g.db.clients.length, 1);
  g.fail = [];
  assert.equal((await confirmWhatsapp({ phone: "11987650006" })).ok, true);
  assert.equal(g.db.clients.length, 1);
  assert.equal(g.db.memberships.length, 1);
});

await test("confirmar: a barbearia e o usuário nunca vêm do pedido", async () => {
  const g = reset();
  await confirmWhatsapp({ phone: "11987650007", tenantId: "outra", userId: "outro" });
  assert.equal(g.db.clients[0].tenant_id, SHOP);
  assert.equal(g.db.clients[0].user_id, USER);
});

// ---- Leituras ------------------------------------------------------------------------------------
await test("getPendingAccount: SIGNED_OUT, PENDING com a marca, PENDING_NO_SHOP e ACTIVE", async () => {
  reset({ user: null });
  assert.deepEqual(await getPendingAccount(), { status: "SIGNED_OUT" });
  reset();
  assert.deepEqual(await getPendingAccount(), {
    status: "PENDING",
    shop: { name: "Barbearia A Teste", logoText: "BA", logoUrl: null, accent: "#123456" },
  });
  reset().cookies.delete("bb_tenant");
  assert.deepEqual(await getPendingAccount(), { status: "PENDING_NO_SHOP" });
  reset().db.memberships.push({ user_id: USER, tenant_id: SHOP, role: "CLIENT" });
  assert.deepEqual(await getPendingAccount(), { status: "ACTIVE" });
});

await test("getMyLoginMethods: google só quando há identidade google", async () => {
  reset();
  assert.deepEqual(await getMyLoginMethods(), { google: true });
  reset({ user: { id: USER, identities: [{ provider: "email" }] } });
  assert.deepEqual(await getMyLoginMethods(), { google: false });
});

// ---- Bloqueio no layout --------------------------------------------------------------------------
await test("layout da área do cliente: conta sem vínculo vai para confirmar WhatsApp antes de qualquer leitura", () => {
  const src = readFileSync(path.join(SRC, "app/client/(app)/layout.tsx"), "utf8");
  const gate = src.indexOf('if (!user.role) redirect("/client/confirmar-whatsapp")');
  assert.ok(gate > 0);
  assert.ok(gate < src.indexOf("getActivePlanBalance()"));
});

await test("logs das ações não levam telefone, nome nem e-mail", () => {
  const src = readFileSync(path.join(SRC, "features/auth/google-actions.ts"), "utf8");
  for (const m of src.matchAll(/console\.(error|warn|log|info)\(([^;]*)\);/g)) {
    assert.doesNotMatch(m[2], /phone|name|email|key\b|user\.id/i, m[0]);
  }
});

await test("navegador: cliente do Google sempre no cookie da área do cliente e em PKCE", () => {
  const src = readFileSync(path.join(SRC, "lib/supabase/client.ts"), "utf8");
  const fn = src.slice(src.indexOf("export function createClientAreaBrowserClient"));
  assert.match(fn, /areaFromKey\("client"\)/);
  assert.match(fn, /flowType: "pkce"/);
  assert.doesNotMatch(fn, /STAFF|VIEW_AS_CLIENT/);
});

console.log(`\n${passed} testes ok`);

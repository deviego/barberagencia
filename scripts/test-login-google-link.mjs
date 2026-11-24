// Testes do vínculo com Google (#171), sem rede e sem banco: o callback do cliente (Google recém-
// ligado a conta com senha), a prova de posse (proveAccountAndLink) e o "Conectar com Google"
// (startGoogleLink) rodam de verdade com dublês de sessão, Auth, banco e cookies. Dados fictícios.
// Roda com: node scripts/test-login-google-link.mjs
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const FAKE = `
const g = () => globalThis.__g;
const log = (x) => g().log.push(x);
const match = (r, f) => Object.entries(f).every(([k, v]) => r[k] === v);
function from(table) {
  const q = { table, f: {}, op: "select" };
  const rows = () => (g().db[table] ??= []);
  const run = () => {
    if (q.op !== "select") log(table + ":" + q.op);
    const hit = rows().filter((r) => match(r, q.f));
    return { data: hit, error: null, count: hit.length };
  };
  const api = {
    select() { return api; }, eq(c, v) { q.f[c] = v; return api; }, limit() { return api; },
    async maybeSingle() { const r = run(); return { data: (r.data ?? [])[0] ?? null, error: null }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
async function rpc(fn, args) {
  const d = g();
  if (fn === "rate_limit_hit") { log("limit:" + args.p_scope); return { data: !(d.limited ?? []).includes(args.p_scope), error: null }; }
  if (fn === "auth_email_for_phone") return { data: d.phoneEmail ?? null, error: null };
  return { data: null, error: { code: "PGRST202" } };
}
const users = () => g().authUsers;
const adminAuth = {
  async getUserById(id) { const u = users()[id]; return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { code: "user_not_found" } }; },
  async updateUserById(id, attrs) { log("admin:update:" + id); users()[id].app_metadata = attrs.app_metadata; return { data: {}, error: null }; },
  async deleteUser(id) { log("admin:delete:" + id); delete users()[id]; return { data: {}, error: null }; },
};
const sessionAuth = {
  async getUser() { return { data: { user: g().session ? users()[g().session] ?? null : null } }; },
  async exchangeCodeForSession() { const u = users()[g().session]; return { data: { user: u }, error: null }; },
  async unlinkIdentity(identity) {
    log("unlink:" + identity.provider);
    const u = users()[g().session];
    u.identities = u.identities.filter((i) => i !== identity);
    return { data: {}, error: null };
  },
  async signOut() { log("signOut"); g().session = null; return { error: null }; },
  async setSession(tokens) { log("setSession:" + tokens.access_token); g().session = tokens.access_token.replace("tok-", ""); return { error: null }; },
};
export function createSupabaseAdminClient() { return { from, rpc, auth: { admin: adminAuth } }; }
export async function createSupabaseServerClient() { return { from, rpc, auth: sessionAuth }; }
export function createServerClient() { return { from, rpc, auth: sessionAuth }; }
export function createClient() {
  return { auth: { async signInWithPassword({ email, password }) {
    log("probe:" + email);
    const acc = g().passwords[email];
    if (!acc || acc.password !== password) return { data: {}, error: { message: "invalid" } };
    return { data: { user: { id: acc.id }, session: { access_token: "tok-" + acc.id, refresh_token: "r" } }, error: null };
  } } };
}
`;
const FAKES = {
  "server-only": "",
  react: "export const cache = (f) => f;",
  "@/lib/supabase/admin": FAKE,
  "@/lib/supabase/server": FAKE,
  "@supabase/ssr": FAKE,
  "@supabase/supabase-js": FAKE,
  "@/lib/supabase/env": "export function supabasePublicEnv() { return { url: 'http://localhost', anonKey: 'x' }; }",
  "next/headers": `export async function cookies() {
    const c = globalThis.__g.cookies;
    return { get: (n) => (c.has(n) ? { name: n, value: c.get(n).value } : undefined), getAll: () => [...c].map(([name, v]) => ({ name, value: v.value })),
             set: (n, v, o) => c.set(n, { value: v, opts: o }), delete: (n) => c.delete(n) };
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
const { proveAccountAndLink, startGoogleLink } = await import("@/features/auth/google-actions");
const { freshGoogleNextToPassword, provisionalEligible } = await import("@/features/auth/google-link-rules");
const { GOOGLE_LOGIN_MESSAGES: MSG } = await import("@/features/auth/google-types");

const O = "https://www.example.test";
const SHOP = "shop-a";
const now = () => new Date().toISOString();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const sha = (v) => createHash("sha256").update(v).digest("hex");

function reset(over = {}) {
  globalThis.__g = {
    authUsers: {},
    session: null,
    cookies: new Map([["bb_tenant", { value: "barbearia-a" }]]),
    db: {
      memberships: [],
      clients: [],
      tenants: [{ id: SHOP, name: "Barbearia A Teste", subdomain: "barbearia-a", kind: "BARBERSHOP", status: "ACTIVE" }],
      branding: [],
    },
    passwords: {},
    log: [],
    ...over,
  };
  return globalThis.__g;
}
/** Conta antiga por senha (e-mail X) que acabou de ganhar o Google X pelo vínculo automático. */
function passwordAccountWithFreshGoogle(g, id = "conta-senha") {
  g.authUsers[id] = {
    id,
    created_at: ago(90 * 86400_000),
    app_metadata: { provider: "email", providers: ["email", "google"] },
    identities: [
      { provider: "email", identity_id: "i-email", created_at: ago(90 * 86400_000), last_sign_in_at: ago(5 * 86400_000) },
      { provider: "google", identity_id: "i-google", created_at: now(), last_sign_in_at: now() },
    ],
  };
  g.db.memberships.push({ user_id: id, tenant_id: SHOP, role: "CLIENT" });
  g.session = id;
  return g.authUsers[id];
}
function provisional(g, id = "prov", extra = {}) {
  g.authUsers[id] = {
    id,
    created_at: ago(60_000),
    app_metadata: { provider: "google", providers: ["google"] },
    identities: [{ provider: "google", identity_id: "i-g-prov", created_at: ago(60_000), last_sign_in_at: ago(60_000) }],
    ...extra,
  };
  g.session = id;
  return g.authUsers[id];
}
const cb = (qs = "code=abc") => callback.GET(new Request(`${O}/client/auth/callback?${qs}`));

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

// ---- Regra pura -------------------------------------------------------------------------------------
await test("regra: Google novo ao lado de senha é recém-ligado; só Google, ou Google antigo, não", () => {
  const t = Date.now();
  const email = { provider: "email", created_at: ago(9e9) };
  assert.ok(freshGoogleNextToPassword([email, { provider: "google", created_at: now(), last_sign_in_at: now() }], t));
  assert.equal(freshGoogleNextToPassword([{ provider: "google", created_at: now(), last_sign_in_at: now() }], t), null);
  assert.equal(freshGoogleNextToPassword([email, { provider: "google", created_at: ago(30 * 86400_000), last_sign_in_at: now() }], t), null);
  assert.ok(freshGoogleNextToPassword([email, { provider: "google", created_at: null }], t), "sem data: trata como recém-criada");
});

// ---- Callback: o caso obrigatório --------------------------------------------------------------
await test("OBRIGATÓRIO: conta por senha com e-mail X + entrar com Google X ⇒ sem sessão e sem Google ligado", async () => {
  const g = reset();
  const u = passwordAccountWithFreshGoogle(g);
  assert.equal((await cb("code=abc&next=/client/agendar")).redirect, `${O}/client/login?error=email_ja_tem_conta`);
  assert.equal(g.session, null, "sem sessão");
  assert.deepEqual(u.identities.map((i) => i.provider), ["email"], "sem identidade google");
  assert.ok(g.log.indexOf("unlink:google") < g.log.indexOf("signOut"));
});

await test("callback: com intenção válida do servidor (perfil/prova), o Google fica ligado", async () => {
  const g = reset();
  const u = passwordAccountWithFreshGoogle(g);
  u.app_metadata.link_intent = { h: sha("tok-ok"), exp: Date.now() + 60_000 };
  g.cookies.set("bb_link_intent", { value: "tok-ok" });
  assert.equal((await cb("code=abc&next=/client/perfil")).redirect, `${O}/client/perfil`);
  assert.deepEqual(u.identities.map((i) => i.provider), ["email", "google"]);
  assert.equal(g.cookies.has("bb_link_intent"), false, "intenção consumida (cookie)");
  assert.equal(u.app_metadata.link_intent, undefined, "intenção consumida (banco)");
});

await test("callback: intenção vencida, de outro valor ou só no banco/só no cookie não vale", async () => {
  for (const setup of [
    (g, u) => { u.app_metadata.link_intent = { h: sha("t"), exp: Date.now() - 1 }; g.cookies.set("bb_link_intent", { value: "t" }); },
    (g, u) => { u.app_metadata.link_intent = { h: sha("t"), exp: Date.now() + 60_000 }; g.cookies.set("bb_link_intent", { value: "outro" }); },
    (g, u) => { u.app_metadata.link_intent = { h: sha("t"), exp: Date.now() + 60_000 }; },
    (g) => { g.cookies.set("bb_link_intent", { value: "t" }); },
  ]) {
    const g = reset();
    const u = passwordAccountWithFreshGoogle(g);
    setup(g, u);
    assert.equal((await cb()).redirect, `${O}/client/login?error=email_ja_tem_conta`);
    assert.deepEqual(u.identities.map((i) => i.provider), ["email"]);
    assert.equal(g.session, null);
  }
});

await test("callback: conta só com Google (nova) e Google ligado há tempo não são barrados", async () => {
  let g = reset();
  provisional(g);
  assert.equal((await cb()).redirect, `${O}/client/confirmar-whatsapp`);
  g = reset();
  const u = passwordAccountWithFreshGoogle(g);
  u.identities[1].created_at = ago(40 * 86400_000);
  assert.equal((await cb("code=abc&next=/client/agendar")).redirect, `${O}/client/agendar`);
  assert.ok(!g.log.includes("unlink:google"));
});

// ---- Prova de posse ---------------------------------------------------------------------------------
const existing = (g) => {
  g.authUsers["conta-velha"] = { id: "conta-velha", created_at: ago(9e9), app_metadata: { provider: "email", providers: ["email"] }, identities: [{ provider: "email" }] };
  g.passwords["c11987650001@cliente.barberagencia.app"] = { id: "conta-velha", password: "senha-certa" };
};

await test("prova: ordem senha → encerra provisória → entra na existente → intenção; resposta LINK_GOOGLE", async () => {
  const g = reset();
  provisional(g);
  existing(g);
  assert.deepEqual(await proveAccountAndLink({ phone: "(11) 98765-0001", password: "senha-certa" }), { ok: true, next: "LINK_GOOGLE" });
  const order = ["probe:", "admin:delete:prov", "setSession:tok-conta-velha", "admin:update:conta-velha"].map((p) =>
    g.log.findIndex((l) => l.startsWith(p))
  );
  assert.ok(order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), g.log.join(" | "));
  assert.equal(g.authUsers.prov, undefined, "provisória encerrada");
  assert.equal(g.session, "conta-velha");
  const c = g.cookies.get("bb_link_intent");
  assert.ok(c && c.opts.httpOnly && c.opts.path === "/client" && c.opts.maxAge <= 600);
  assert.equal(g.authUsers["conta-velha"].app_metadata.link_intent.h, sha(c.value));
  assert.equal(g.authUsers["conta-velha"].app_metadata.provider, "email", "app_metadata preservado");
});

await test("prova: senha errada ou telefone sem conta → WRONG_CREDENTIALS, provisória intacta", async () => {
  for (const [phone, password] of [["11987650001", "errada"], ["11987650099", "senha-certa"], ["abc", "x"]]) {
    const g = reset();
    provisional(g);
    existing(g);
    assert.deepEqual(await proveAccountAndLink({ phone, password }), { ok: false, code: "WRONG_CREDENTIALS", error: MSG.wrongCredentials });
    assert.ok(g.authUsers.prov, "provisória não encerrada");
    assert.equal(g.session, "prov");
  }
});

await test("prova: conta da sessão que não é provisória vazia → NOT_ELIGIBLE, nem tenta a senha", async () => {
  const cases = [
    (g) => g.db.memberships.push({ user_id: "prov", tenant_id: SHOP, role: "CLIENT" }),
    (g) => g.db.clients.push({ id: "c1", user_id: "prov" }),
    (g) => (g.authUsers.prov.created_at = ago(25 * 3600_000)),
    (g) => (g.authUsers.prov.app_metadata = { provider: "email", providers: ["email"] }),
    (g) => (g.authUsers.prov.app_metadata = { provider: "google", providers: ["google", "email"] }),
    (g) => g.authUsers.prov.identities.push({ provider: "email" }),
  ];
  for (const setup of cases) {
    const g = reset();
    provisional(g);
    existing(g);
    setup(g);
    assert.equal((await proveAccountAndLink({ phone: "11987650001", password: "senha-certa" })).code, "NOT_ELIGIBLE");
    assert.ok(g.authUsers.prov, "nada encerrado");
    assert.ok(!g.log.some((l) => l.startsWith("probe:")), "senha não testada");
  }
});

await test("prova: limite por conta provisória e por telefone, antes de qualquer outra coisa", async () => {
  for (const scope of ["google_prove_user", "google_prove_phone"]) {
    const g = reset({ limited: [scope] });
    provisional(g);
    existing(g);
    assert.equal((await proveAccountAndLink({ phone: "11987650001", password: "senha-certa" })).code, "LIMIT");
    assert.ok(!g.log.some((l) => l.startsWith("probe:") || l.startsWith("admin:")));
  }
});

await test("prova: sem sessão → NOT_SIGNED_IN; senha que entra na própria conta da sessão não vale", async () => {
  let g = reset();
  existing(g);
  assert.equal((await proveAccountAndLink({ phone: "11987650001", password: "senha-certa" })).code, "NOT_SIGNED_IN");
  g = reset();
  provisional(g);
  g.passwords["c11987650001@cliente.barberagencia.app"] = { id: "prov", password: "x" };
  assert.equal((await proveAccountAndLink({ phone: "11987650001", password: "x" })).code, "WRONG_CREDENTIALS");
  assert.ok(g.authUsers.prov);
});

await test("regra de descarte: só o id da sessão", () => {
  const user = { id: "a", created_at: now(), app_metadata: { provider: "google", providers: ["google"] }, identities: [{ provider: "google" }] };
  assert.equal(provisionalEligible({ sessionUserId: "a", user, memberships: 0, clients: 0, now: Date.now() }), true);
  assert.equal(provisionalEligible({ sessionUserId: "b", user, memberships: 0, clients: 0, now: Date.now() }), false);
});

// ---- Conectar com Google (perfil) ----------------------------------------------------------------
await test("conectar pelo perfil: cliente logado ganha a intenção; sem sessão ou sem vínculo, não", async () => {
  let g = reset();
  g.authUsers.cli = { id: "cli", app_metadata: { provider: "email" }, identities: [{ provider: "email" }] };
  g.db.memberships.push({ user_id: "cli", tenant_id: SHOP, role: "CLIENT" });
  g.session = "cli";
  assert.deepEqual(await startGoogleLink(), { ok: true });
  assert.ok(g.cookies.has("bb_link_intent"));
  assert.ok(g.authUsers.cli.app_metadata.link_intent);
  g = reset();
  assert.equal((await startGoogleLink()).code, "NOT_SIGNED_IN");
  g = reset();
  provisional(g);
  assert.equal((await startGoogleLink()).code, "GENERIC");
  assert.equal(g.cookies.has("bb_link_intent"), false);
});

await test("logs do vínculo não levam telefone, e-mail nem id", () => {
  for (const f of ["features/auth/google-actions.ts", "features/auth/google-link.ts", "app/client/auth/callback/route.ts"]) {
    const src = readFileSync(path.join(SRC, f), "utf8");
    for (const m of src.matchAll(/console\.(error|warn|log|info)\(([^;]*)\);/g)) {
      assert.doesNotMatch(m[2], /phone|email|key\b|user\.id|userId/i, `${f}: ${m[0]}`);
    }
  }
});

console.log(`\n${passed} testes ok`);

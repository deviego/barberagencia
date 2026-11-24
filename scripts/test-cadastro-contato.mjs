// Testes do cadastro do cliente, login, recuperação de senha e confirmação do e-mail de contato
// (#177), sem rede e sem banco: as ações de verdade rodam com dublês de Auth, banco e cookies.
// O comportamento no banco (cadastro, convite, resolução do contato) está em
// scripts/test-cadastro-contato-db.mjs. Dados fictícios.
// Roda com: node scripts/test-cadastro-contato.mjs
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const sha = (v) => createHash("sha256").update(v).digest("hex");

const FAKE = `
const g = () => globalThis.__g;
const log = (x) => g().log.push(x);
const match = (r, f) => Object.entries(f).every(([k, v]) => (typeof v === "function" ? v(r[k]) : r[k] === v));
function from(table) {
  const q = { f: {}, op: "select", values: null };
  const rows = () => (g().db[table] ??= []);
  const run = () => {
    if (q.op === "insert") { rows().push({ ...q.values }); log(table + ":insert"); return { data: null, error: null }; }
    const hit = rows().filter((r) => match(r, q.f));
    if (q.op === "update") { hit.forEach((r) => Object.assign(r, q.values)); log(table + ":update"); }
    return { data: hit, error: null };
  };
  const api = {
    select() { return api; }, order() { return api; }, limit() { return api; },
    eq(c, v) { q.f[c] = v; return api; },
    is(c, v) { q.f[c] = (x) => (x ?? null) === v; return api; },
    gt(c, v) { q.f[c] = (x) => x > v; return api; },
    ilike(c, v) { const want = v.replace(/\\\\(.)/g, "$1").toLowerCase(); q.f[c] = (x) => (x ?? "").toLowerCase() === want; return api; },
    insert(v) { q.op = "insert"; q.values = v; return api; },
    update(v) { q.op = "update"; q.values = v; return api; },
    async maybeSingle() { const r = run(); return { data: (r.data ?? [])[0] ?? null, error: null }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
async function rpc(fn, args) {
  const d = g();
  if (fn === "rate_limit_hit") {
    log("limit:" + args.p_scope);
    if ((d.limitDown ?? []).includes(args.p_scope)) return { data: null, error: { code: "XX000" } };
    return { data: !(d.limited ?? []).includes(args.p_scope), error: null };
  }
  if (fn === "auth_email_for_phone") return { data: d.phoneAuth?.[args.p_digits] ?? null, error: null };
  if (fn === "auth_email_for_contact_email") return { data: d.contactAuth?.[args.p_email] ?? null, error: null };
  if (fn === "finalize_client_signup") {
    d.finalized.push(args);
    const next = (d.finalizeQueue ?? []).shift();
    if (next === "ERROR") return { data: null, error: { code: "57014" } };
    return { data: next ?? d.finalizeResult ?? "OK", error: null };
  }
  return { data: null, error: { code: "PGRST202" } };
}
const adminAuth = {
  async createUser(attrs) {
    const d = g();
    if (Object.values(d.users).some((u) => u.email === attrs.email)) return { data: {}, error: { message: "User already registered" } };
    const id = "u" + (Object.keys(d.users).length + 1);
    d.users[id] = { id, created_at: d.createdAt ?? new Date().toISOString(), ...attrs };
    if (d.authAppMeta) d.users[id].app_metadata = structuredClone(d.authAppMeta);
    log("createUser");
    return { data: { user: d.users[id] }, error: null };
  },
  async getUserById(id) {
    const d = g();
    log("getUserById");
    if (d.authDown) return { data: { user: null }, error: { message: "down" } };
    const u = d.users[id];
    return u ? { data: { user: structuredClone(u) }, error: null } : { data: { user: null }, error: { message: "not found" } };
  },
  // Como o Auth: mescla o app_metadata por chave; chave com null é apagada, chave ausente fica.
  async updateUserById(id, attrs) {
    const d = g();
    log("updateUserById");
    if (d.updateDown) return { data: {}, error: { message: "down" } };
    const u = d.users[id];
    if (attrs.app_metadata && d.replaceAppMeta) u.app_metadata = { ...attrs.app_metadata };
    else if (attrs.app_metadata) {
      const meta = { ...(u.app_metadata ?? {}) };
      for (const [k, v] of Object.entries(attrs.app_metadata)) if (v === null) delete meta[k]; else meta[k] = v;
      u.app_metadata = meta;
    }
    return { data: { user: u }, error: null };
  },
  async generateLink({ type, email }) {
    const u = Object.values(g().users).find((x) => x.email === email);
    log("generateLink:" + type);
    if (!u) return { data: {}, error: { message: "not found" } };
    return { data: { user: { id: u.id }, properties: { hashed_token: "h-" + u.id } }, error: null };
  },
};
const sessionAuth = {
  async getUser() { return { data: { user: g().session ? g().users[g().session] : null } }; },
  async signInWithPassword({ email, password }) {
    log("signIn:" + email);
    const u = Object.values(g().users).find((x) => x.email === email && x.password === password);
    return u ? { data: { user: u }, error: null } : { data: {}, error: { message: "invalid" } };
  },
};
export function createSupabaseAdminClient() { return { from, rpc, auth: { admin: adminAuth } }; }
export async function createSupabaseServerClient() { return { from, rpc, auth: sessionAuth }; }
`;
const FAKES = {
  "server-only": "",
  react: "export const cache = (f) => f;",
  "@/lib/supabase/admin": FAKE,
  "@/lib/supabase/server": FAKE,
  "next/cache": "export function revalidatePath() {}",
  "next/navigation": "export function redirect() {}",
  "next/headers": "export async function cookies() { return { get() {}, set() {}, delete() {}, getAll() { return []; } }; } export async function headers() { return new Map([['host', 'www.example.test']]); }",
  "@/lib/http": "export async function getRequestOrigin() { return 'https://www.example.test'; }",
  "@/lib/tenant/resolve": "export const TENANT_COOKIE = 'bb_tenant'; export async function getCurrentTenant() { return { id: 'shop-a', name: 'Barbearia A Teste' }; }",
  "@/lib/auth/session": "export async function getSessionUser() { return null; }",
  "@/server/notifications/notify": `
    export async function notifyPasswordReset(email, link) { globalThis.__g.mails.push({ kind: "reset", email, link }); return { ok: true }; }
    export async function notifyContactConfirmation(email, link, o) { globalThis.__g.mails.push({ kind: o?.welcome ? "welcome+confirm" : "confirm", email, link }); return { ok: true }; }
    export async function notifyWelcome(email) { globalThis.__g.mails.push({ kind: "welcome", email }); }`,
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

const { registerClientAccount, signInWithIdentifier, sendWelcomeEmail } = await import("@/features/auth/actions");
const { requestPasswordReset } = await import("@/features/auth/password-reset");
const { updateContactEmail, resendContactEmailConfirmation } = await import("@/features/auth/contact-actions");
const { consumeContactConfirmation, createContactConfirmation } = await import("@/features/auth/contact-email");
const { completeInviteAcceptance, completePendingInvite } = await import("@/features/auth/invite-actions");
const { hasPendingInvite, PENDING_INVITE_WINDOW_MS } = await import("@/features/auth/pending-invite");
const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");

function reset(over = {}) {
  globalThis.__g = {
    users: {},
    session: null,
    db: { client_invites: [], profiles: [], clients: [], contact_email_confirmations: [] },
    mails: [],
    log: [],
    finalized: [],
    ...over,
  };
  return globalThis.__g;
}
const TECH = (d) => `c${d}@cliente.barberagencia.app`;

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

// ---- Cadastro -----------------------------------------------------------------------------------
await test("cadastro com e-mail real: autenticação SEMPRE técnica; e-mail real só como contato (finalizado pelo servidor)", async () => {
  const g = reset();
  const r = await registerClientAccount({ name: "Ana Teste", phone: "(11) 98765-0001", password: "senha-forte", email: "Ana@Example.test", tenantSubdomain: "barbearia-a" });
  assert.deepEqual(r, { ok: true, authEmail: TECH("11987650001") });
  const u = Object.values(g.users)[0];
  assert.equal(u.email, TECH("11987650001"));
  assert.notEqual(u.email, "ana@example.test");
  assert.equal(u.app_metadata, undefined);
  assert.equal(u.user_metadata.contact_email, undefined, "contato nunca em user_metadata");
  assert.equal(u.user_metadata.tenant_subdomain, "barbearia-a");
  assert.deepEqual(g.finalized, [{ p_user_id: u.id, p_contact_email: "ana@example.test", p_invite_token_hash: null }]);
});

await test("cadastro sem convite não leva convite; com convite leva só o HASH do token e nada de barbearia do pedido", async () => {
  let g = reset();
  await registerClientAccount({ name: "Bia Teste", phone: "11987650002", password: "senha-forte" });
  assert.equal(g.finalized[0].p_invite_token_hash, null);
  g = reset();
  g.db.client_invites.push({ token: "convite-token-abc", status: "PENDING", expires_at: new Date(Date.now() + 86400_000).toISOString() });
  await registerClientAccount({ name: "Caio Teste", phone: "11987650003", password: "senha-forte", tenantSubdomain: "outra", inviteToken: "convite-token-abc" });
  assert.equal(g.finalized[0].p_invite_token_hash, sha("convite-token-abc"));
  assert.equal(Object.values(g.users)[0].user_metadata.tenant_subdomain, undefined, "com convite, barbearia só do convite");
  assert.doesNotMatch(JSON.stringify(Object.values(g.users)[0]), /convite-token-abc/);
  // Convite usado no meio do caminho (corrida): a conta já existe; o cadastro responde ok com
  // pendingInvite para a tela concluir o aceite já logada (nunca "tente de novo").
  g = reset({ finalizeResult: "INVITE_INVALID" });
  g.db.client_invites.push({ token: "convite-token-xyz", status: "PENDING", expires_at: new Date(Date.now() + 86400_000).toISOString() });
  assert.deepEqual(
    await registerClientAccount({ name: "Caio", phone: "11987650013", password: "senha-forte", inviteToken: "convite-token-xyz" }),
    { ok: true, authEmail: TECH("11987650013"), pendingInvite: true }
  );
});

await test("convite vencido, já aceito ou inexistente: recusa antes de criar a conta", async () => {
  for (const inv of [
    { token: "tok-vencido-1", status: "PENDING", expires_at: new Date(Date.now() - 1000).toISOString() },
    { token: "tok-aceito-12", status: "ACCEPTED", expires_at: new Date(Date.now() + 86400_000).toISOString() },
    null,
  ]) {
    const g = reset();
    if (inv) g.db.client_invites.push(inv);
    const r = await registerClientAccount({ name: "Davi Teste", phone: "11987650004", password: "senha-forte", inviteToken: inv?.token ?? "tok-nenhum-9" });
    assert.deepEqual(r, { ok: false, error: "Este convite não vale mais." });
    assert.equal(Object.keys(g.users).length, 0);
  }
});

await test("telefone que já tem conta: mensagem de conta existente; e-mail técnico como contato é recusado", async () => {
  const g = reset();
  await registerClientAccount({ name: "Eva Teste", phone: "11987650005", password: "senha-forte" });
  const r = await registerClientAccount({ name: "Eva Dois", phone: "11987650005", password: "senha-forte" });
  assert.equal(r.ok, false);
  assert.equal(Object.keys(g.users).length, 1);
  const r2 = await registerClientAccount({ name: "Fabi", phone: "11987650006", password: "senha-forte", email: TECH("11987650006") });
  assert.equal(r2.ok, false);
});

// ---- Falha entre criar a conta e finalizar ---------------------------------------------------------
const pendingInviteDb = (g, token) =>
  g.db.client_invites.push({ token, status: "PENDING", expires_at: new Date(Date.now() + 86400_000).toISOString() });

await test("cadastro comum: finalização falhando (erro ou INVALID) responde ok — a conta já existe", async () => {
  for (const q of [["ERROR"], ["INVALID"]]) {
    const g = reset({ finalizeQueue: [...q] });
    const r = await registerClientAccount({ name: "Gui Teste", phone: "11987650021", password: "senha-forte", email: "gui@example.test" });
    assert.deepEqual(r, { ok: true, authEmail: TECH("11987650021") }, q[0]);
    assert.equal(g.finalized.length, 1, "sem nova tentativa no cadastro comum");
  }
});

await test("convite: finalização falha → tenta de novo na hora; dando certo, sem pendência", async () => {
  const g = reset({ finalizeQueue: ["ERROR", "OK"] });
  pendingInviteDb(g, "convite-token-r1");
  const r = await registerClientAccount({ name: "Hugo", phone: "11987650022", password: "senha-forte", inviteToken: "convite-token-r1" });
  assert.deepEqual(r, { ok: true, authEmail: TECH("11987650022") });
  assert.equal(g.finalized.length, 2);
});

await test("convite: falha de novo (erro, INVITE_INVALID ou INVALID) → ok com pendingInvite (conclui logado)", async () => {
  for (const q of [["ERROR", "ERROR"], ["INVITE_INVALID", "INVITE_INVALID"], ["INVALID", "INVALID"]]) {
    const g = reset({ finalizeQueue: [...q] });
    pendingInviteDb(g, "convite-token-r2");
    const r = await registerClientAccount({ name: "Iara", phone: "11987650023", password: "senha-forte", inviteToken: "convite-token-r2" });
    assert.deepEqual(r, { ok: true, authEmail: TECH("11987650023"), pendingInvite: true }, q[0]);
    assert.equal(g.finalized.length, 2);
  }
});

await test("concluir aceite: só a conta da SESSÃO, com o hash do token; sem sessão ou convite inválido recusa", async () => {
  let g = reset();
  assert.equal((await completeInviteAcceptance("convite-token-r3")).code, "NOT_SIGNED_IN");
  assert.equal(g.finalized.length, 0);
  g = reset();
  g.users.u7 = { id: "u7", email: TECH("11987650024") };
  g.session = "u7";
  g.db.profiles.push({ id: "u7", contact_email: "iara@example.test" });
  assert.deepEqual(await completeInviteAcceptance("convite-token-r3"), { ok: true });
  assert.deepEqual(g.finalized, [{ p_user_id: "u7", p_contact_email: "iara@example.test", p_invite_token_hash: sha("convite-token-r3") }]);
  g = reset({ finalizeResult: "INVITE_INVALID" });
  g.users.u7 = { id: "u7" };
  g.session = "u7";
  assert.equal((await completeInviteAcceptance("convite-token-r3")).code, "INVALID_INVITE");
  assert.equal((await completeInviteAcceptance("../x")).code, "INVALID_INVITE");
});

// ---- Convite pendente (marcador do servidor) -----------------------------------------------------
const AUTH_META = { provider: "email", providers: ["email"], google_linked: ["gid-1"] };
const HOUR = PENDING_INVITE_WINDOW_MS;
const CREATED = new Date(Date.now() - 60_000).toISOString();
async function pendingSignup(over = {}, token = "convite-token-p1") {
  const g = reset({ finalizeQueue: ["ERROR", "ERROR"], authAppMeta: AUTH_META, createdAt: CREATED, ...over });
  pendingInviteDb(g, token);
  g.db.profiles.push({ id: "u1", contact_email: "jo@example.test" });
  const r = await registerClientAccount({ name: "Jo Teste", phone: "11987650031", password: "senha-forte", inviteToken: token });
  return { g, r, u: g.users.u1 };
}
const errors = [];
const realError = console.error;
console.error = (...a) => errors.push(a.join(" "));

await test("convite pendente: o cadastro grava o marcador (hash, fim da janela de 1 h) sem perder o resto do app_metadata", async () => {
  const { g, r, u } = await pendingSignup();
  assert.equal(r.pendingInvite, true);
  assert.deepEqual(u.app_metadata, {
    ...AUTH_META,
    pending_invite: { h: sha("convite-token-p1"), exp: Date.parse(CREATED) + HOUR },
  });
  assert.doesNotMatch(JSON.stringify(u), /convite-token-p1/, "nunca o token, só o hash");
  assert.equal(u.user_metadata.pending_invite, undefined, "marcador nunca em user_metadata");
  // Cadastro que liga o convite de primeira não marca nada.
  const ok = reset({ authAppMeta: AUTH_META });
  pendingInviteDb(ok, "convite-token-p2");
  await registerClientAccount({ name: "Lia", phone: "11987650032", password: "senha-forte", inviteToken: "convite-token-p2" });
  assert.deepEqual(ok.users.u1.app_metadata, AUTH_META);
  assert.ok(!ok.log.includes("updateUserById"));
});

await test("convite pendente: gravar e limpar mandam o app_metadata INTEIRO (lido do Auth), mesmo se o Auth substituísse", async () => {
  const { g, u } = await pendingSignup({ replaceAppMeta: true });
  assert.deepEqual(u.app_metadata.providers, ["email"]);
  assert.deepEqual(u.app_metadata.google_linked, ["gid-1"]);
  assert.ok(u.app_metadata.pending_invite);
  g.finalizeQueue = ["OK"];
  await signInWithIdentifier("11987650031", "senha-forte");
  assert.deepEqual({ ...u.app_metadata, pending_invite: undefined }, { ...AUTH_META, pending_invite: undefined });
  assert.equal(u.app_metadata.pending_invite ?? null, null);
});

await test("convite pendente: falha ao gravar o marcador não muda a resposta do cadastro (só registra, sem dado pessoal)", async () => {
  for (const over of [{ updateDown: true }, { authDown: true }]) {
    errors.length = 0;
    const { r, u } = await pendingSignup(over);
    assert.deepEqual(r, { ok: true, authEmail: TECH("11987650031"), pendingInvite: true });
    assert.equal(u.app_metadata.pending_invite, undefined);
    assert.ok(errors.some((e) => e.includes("marcador")));
    assert.doesNotMatch(errors.join("\n"), /11987650031|jo@example|convite-token|u1/);
  }
});

await test("login com senha certa conclui o convite pendente da PRÓPRIA conta e limpa o marcador (resto mantido)", async () => {
  const { g, u } = await pendingSignup();
  g.finalized.length = 0;
  g.finalizeQueue = ["OK"];
  assert.deepEqual(await signInWithIdentifier("11987650031", "senha-forte"), { ok: true });
  assert.deepEqual(g.finalized, [{ p_user_id: u.id, p_contact_email: "jo@example.test", p_invite_token_hash: sha("convite-token-p1") }]);
  assert.deepEqual(u.app_metadata, AUTH_META);
});

await test("login: recusa do banco também limpa; erro de banco mantém o marcador; nada disso muda o login", async () => {
  for (const [res, kept] of [["INVITE_INVALID", false], ["INVALID", false], ["ERROR", true]]) {
    const { g, u } = await pendingSignup();
    g.finalizeQueue = [res];
    assert.deepEqual(await signInWithIdentifier("11987650031", "senha-forte"), { ok: true }, res);
    assert.equal(u.app_metadata.pending_invite !== undefined, kept, res);
    assert.deepEqual(u.app_metadata.providers, ["email"]);
  }
});

await test("login: marcador vencido é só limpo (sem finalize); senha errada não toca em nada", async () => {
  const past = new Date(Date.now() - 2 * HOUR).toISOString();
  let { g, u } = await pendingSignup({ createdAt: past });
  g.finalized.length = 0;
  assert.deepEqual(await signInWithIdentifier("11987650031", "senha-forte"), { ok: true });
  assert.equal(g.finalized.length, 0);
  assert.deepEqual(u.app_metadata, AUTH_META);

  ({ g, u } = await pendingSignup());
  g.finalized.length = 0;
  assert.equal((await signInWithIdentifier("11987650031", "senha-errada")).ok, false);
  assert.equal(g.finalized.length, 0);
  assert.ok(u.app_metadata.pending_invite);
});

await test("login sem marcador: nem lê a conta no Auth (custo zero para o login comum)", async () => {
  const g = reset({ authAppMeta: AUTH_META });
  await registerClientAccount({ name: "Mel", phone: "11987650033", password: "senha-forte" });
  g.log.length = 0;
  assert.deepEqual(await signInWithIdentifier("11987650033", "senha-forte"), { ok: true });
  assert.ok(!g.log.includes("getUserById") && !g.log.includes("updateUserById"));
});

await test("concluir sem token: só a conta da SESSÃO, só pelo marcador; sem marcador ou vencido recusa", async () => {
  let { g, u } = await pendingSignup();
  g.finalized.length = 0;
  assert.equal((await completePendingInvite()).code, "NOT_SIGNED_IN");
  assert.equal(g.finalized.length, 0);
  g.session = u.id;
  g.finalizeQueue = ["OK"];
  assert.deepEqual(await completePendingInvite(), { ok: true });
  assert.deepEqual(g.finalized, [{ p_user_id: u.id, p_contact_email: "jo@example.test", p_invite_token_hash: sha("convite-token-p1") }]);
  assert.deepEqual(u.app_metadata, AUTH_META);
  // Já concluído (sem marcador): recusa sem chamar o banco.
  assert.equal((await completePendingInvite()).code, "INVALID_INVITE");
  assert.equal(g.finalized.length, 1);
  // Erro de banco: tente de novo (marcador fica).
  ({ g, u } = await pendingSignup());
  g.session = u.id;
  g.finalizeQueue = ["ERROR"];
  assert.equal((await completePendingInvite()).code, "GENERIC");
  assert.ok(u.app_metadata.pending_invite);
  // Vencido: limpa e recusa, sem banco.
  ({ g, u } = await pendingSignup({ createdAt: new Date(Date.now() - 2 * HOUR).toISOString() }));
  g.session = u.id;
  g.finalized.length = 0;
  assert.equal((await completePendingInvite()).code, "INVALID_INVITE");
  assert.equal(g.finalized.length, 0);
  assert.deepEqual(u.app_metadata, AUTH_META);
});

await test("área do cliente: marcador válido manda concluir; vencido é limpo; concluir pelo link também limpa", async () => {
  let { g, u } = await pendingSignup();
  assert.equal(await hasPendingInvite(u.id), true);
  ({ g, u } = await pendingSignup({ createdAt: new Date(Date.now() - 2 * HOUR).toISOString() }));
  assert.equal(await hasPendingInvite(u.id), false);
  assert.deepEqual(u.app_metadata, AUTH_META);
  ({ g, u } = await pendingSignup({ authDown: false }));
  g.session = u.id;
  g.finalizeQueue = ["OK"];
  assert.deepEqual(await completeInviteAcceptance("convite-token-p1"), { ok: true });
  assert.deepEqual(u.app_metadata, AUTH_META);
  g.authDown = true;
  assert.equal(await hasPendingInvite(u.id), false, "Auth fora: segue o fluxo normal");
});
console.error = realError;

// ---- Login --------------------------------------------------------------------------------------
await test("login por e-mail: só contato CONFIRMADO resolve (função do banco); senão vale o e-mail digitado", async () => {
  const g = reset({ contactAuth: { "ana@example.test": TECH("11987650001") } });
  g.users.u1 = { id: "u1", email: TECH("11987650001"), password: "certa" };
  assert.deepEqual(await signInWithIdentifier("Ana@Example.test", "certa"), { ok: true });
  assert.ok(g.log.includes("signIn:" + TECH("11987650001")));
  // Contato não confirmado/ambíguo: a função devolve null; o e-mail digitado não é de nenhuma conta.
  const g2 = reset();
  g2.users.u1 = { id: "u1", email: TECH("11987650001"), password: "certa" };
  assert.deepEqual(await signInWithIdentifier("ana@example.test", "certa"), { ok: false, error: "Telefone/e-mail ou senha inválidos." });
});

await test("login: sem conseguir conferir o limite, recusa com a mensagem genérica (não segue sem limite)", async () => {
  const g = reset({ limitDown: ["login_identifier"] });
  g.users.u1 = { id: "u1", email: TECH("11987650001"), password: "certa" };
  assert.deepEqual(await signInWithIdentifier("11987650001", "certa"), { ok: false, error: "Telefone/e-mail ou senha inválidos." });
  assert.ok(!g.log.some((l) => l.startsWith("signIn:")));
});

await test("login: limite por identificador e por conta, com a mesma mensagem de senha errada", async () => {
  for (const scope of ["login_identifier", "login_account"]) {
    const g = reset({ limited: [scope] });
    g.users.u1 = { id: "u1", email: TECH("11987650001"), password: "certa" };
    assert.deepEqual(await signInWithIdentifier("11987650001", "certa"), { ok: false, error: "Telefone/e-mail ou senha inválidos." });
    assert.ok(!g.log.some((l) => l.startsWith("signIn:")), "nem tenta entrar");
  }
});

// ---- Recuperação de senha -----------------------------------------------------------------------
await test("recuperação: link vai para o contato CONFIRMADO, com código de uso único no link", async () => {
  const g = reset({ contactAuth: { "ana@example.test": TECH("11987650001") } });
  g.users.u1 = { id: "u1", email: TECH("11987650001") };
  g.db.profiles.push({ id: "u1", contact_email: "ana@example.test", contact_email_verified_at: new Date().toISOString() });
  g.db.clients.push({ user_id: "u1", tenant_id: "shop-a", created_at: "2026-01-01" });
  assert.deepEqual(await requestPasswordReset("ana@example.test"), { ok: true });
  assert.equal(g.mails.length, 1);
  assert.equal(g.mails[0].email, "ana@example.test");
  assert.equal(g.mails[0].link, "https://www.example.test/client/auth/confirm?type=recovery&token_hash=h-u1");
});

await test("recuperação: contato NÃO confirmado, conta só por telefone sem contato, ou sem conta ⇒ mesma resposta e nada enviado", async () => {
  const cases = [
    (g) => { g.users.u1 = { id: "u1", email: TECH("11987650001") }; g.db.profiles.push({ id: "u1", contact_email: "ana@example.test", contact_email_verified_at: null }); g.phoneAuth = { "11987650001": TECH("11987650001") }; return "11987650001"; },
    (g) => { g.users.u1 = { id: "u1", email: TECH("11987650001") }; g.db.profiles.push({ id: "u1", contact_email: null }); g.phoneAuth = { "11987650001": TECH("11987650001") }; return "11987650001"; },
    () => "ninguem@example.test",
  ];
  for (const setup of cases) {
    const g = reset();
    const id = setup(g);
    assert.deepEqual(await requestPasswordReset(id), { ok: true });
    assert.equal(g.mails.length, 0);
  }
});

await test("recuperação: conta antiga (e-mail real de autenticação) recebe no próprio e-mail; técnico nunca", async () => {
  const g = reset();
  g.users.u1 = { id: "u1", email: "antiga@example.test" };
  g.db.profiles.push({ id: "u1", contact_email: null });
  await requestPasswordReset("antiga@example.test");
  assert.deepEqual(g.mails.map((m) => m.email), ["antiga@example.test"]);
  const g2 = reset();
  g2.users.u1 = { id: "u1", email: TECH("11987650001") };
  g2.db.profiles.push({ id: "u1", contact_email: null });
  await requestPasswordReset(TECH("11987650001"));
  assert.equal(g2.mails.length, 0);
});

await test("recuperação: limite por identificador e por conta; resposta sempre igual", async () => {
  for (const scope of ["password_reset", "password_reset_account"]) {
    const g = reset({ limited: [scope], contactAuth: { "ana@example.test": TECH("11987650001") } });
    g.users.u1 = { id: "u1", email: TECH("11987650001") };
    g.db.profiles.push({ id: "u1", contact_email: "ana@example.test", contact_email_verified_at: new Date().toISOString() });
    assert.deepEqual(await requestPasswordReset("ana@example.test"), { ok: true });
    assert.equal(g.mails.length, 0, scope);
  }
});

// ---- Confirmação do contato ---------------------------------------------------------------------
await test("confirmação: token de uso único confirma o contato atual; vencido, usado ou de contato trocado não", async () => {
  const g = reset();
  const admin = createSupabaseAdminClient();
  g.db.profiles.push({ id: "u1", contact_email: "ana@example.test", contact_email_verified_at: null });
  const tok = await createContactConfirmation(admin, "u1", "ana@example.test");
  assert.equal(g.db.contact_email_confirmations[0].token_hash, sha(tok), "banco guarda só o resumo");
  assert.equal(await consumeContactConfirmation(admin, tok), "ok");
  assert.ok(g.db.profiles[0].contact_email_verified_at);
  assert.equal(await consumeContactConfirmation(admin, tok), "invalid", "uso único");
  // Contato trocado depois do pedido: o link antigo não confirma o novo.
  g.db.profiles[0] = { id: "u1", contact_email: "novo@example.test", contact_email_verified_at: null };
  const tok2 = await createContactConfirmation(admin, "u1", "ana@example.test");
  assert.equal(await consumeContactConfirmation(admin, tok2), "invalid");
  assert.equal(g.db.profiles[0].contact_email_verified_at, null);
  // Vencido.
  const tok3 = await createContactConfirmation(admin, "u1", "novo@example.test");
  g.db.contact_email_confirmations.at(-1).expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal(await consumeContactConfirmation(admin, tok3), "invalid");
  assert.equal(await consumeContactConfirmation(admin, "x"), "invalid");
});

await test("trocar o contato no perfil zera a confirmação e manda novo link; reenviar respeita limite", async () => {
  const g = reset();
  g.users.u1 = { id: "u1", email: TECH("11987650001") };
  g.session = "u1";
  g.db.profiles.push({ id: "u1", contact_email: "ana@example.test", contact_email_verified_at: "2026-01-01" });
  g.db.clients.push({ user_id: "u1", email: "ana@example.test" });
  assert.deepEqual(await updateContactEmail("Nova@Example.test"), { ok: true });
  assert.deepEqual(
    [g.db.profiles[0].contact_email, g.db.profiles[0].contact_email_verified_at, g.db.clients[0].email],
    ["nova@example.test", null, "nova@example.test"]
  );
  assert.deepEqual(g.mails.map((m) => [m.kind, m.email]), [["confirm", "nova@example.test"]]);
  assert.match(g.mails[0].link, /^https:\/\/www\.example\.test\/client\/auth\/confirmar-contato\?token=/);
  assert.equal((await updateContactEmail("x")).code, "INVALID_EMAIL");
  g.limited = ["contact_confirm_user"];
  assert.equal((await resendContactEmailConfirmation()).code, "LIMIT");
  g.session = null;
  assert.equal((await resendContactEmailConfirmation()).code, "NOT_SIGNED_IN");
});

await test("boas-vindas: contato não confirmado recebe boas-vindas + link de confirmação num e-mail só", async () => {
  const g = reset();
  g.users.u1 = { id: "u1", email: TECH("11987650001"), user_metadata: { full_name: "Ana Teste" } };
  g.session = "u1";
  g.db.profiles.push({ id: "u1", contact_email: "ana@example.test", contact_email_verified_at: null });
  await sendWelcomeEmail();
  assert.deepEqual(g.mails.map((m) => [m.kind, m.email]), [["welcome+confirm", "ana@example.test"]]);
});

await test("nenhum e-mail vai para o domínio técnico", () => {
  const src = readFileSync(path.join(SRC, "features/auth/account-lookup.ts"), "utf8");
  assert.match(src, /isTechnicalEmail\(target\)/);
});

console.log(`\n${passed} testes ok`);

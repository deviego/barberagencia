// Testes do interruptor da fila rápida (#102) e da renovação da chave do totem (#103), sem rede e
// sem banco: as ações de verdade (admin-actions.ts e regenerateTotemToken) rodam com um banco
// falso em memória e uma sessão falsa. Dados fictícios.
// Roda com: node scripts/test-quick-queue-admin.mjs
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

// Banco falso: globalThis.__adm.tables[tabela] = linhas; registra escritas em __adm.writes.
const FAKE_SUPABASE = `
const db = () => globalThis.__adm;
const match = (row, f) => Object.entries(f).every(([k, v]) => row[k] === v);
function query(table) {
  const q = { table, filters: {}, op: "select", values: null, opts: null };
  const rows = () => (db().tables[table] ??= []);
  const run = () => {
    const d = db();
    if (d.fail?.includes(table + ":" + q.op)) return { data: null, error: { code: "XX000" } };
    if (q.op === "update") {
      const hit = rows().filter((r) => match(r, q.filters));
      hit.forEach((r) => Object.assign(r, q.values));
      d.writes.push({ table, op: "update", filters: { ...q.filters }, values: q.values });
      return { data: hit, error: null };
    }
    if (q.op === "insert") {
      rows().push({ ...q.values });
      d.writes.push({ table, op: "insert", values: q.values });
      return { data: null, error: null };
    }
    if (q.op === "upsert") {
      const key = q.opts?.onConflict;
      const found = rows().find((r) => r[key] === q.values[key]);
      if (found) Object.assign(found, q.values); else rows().push({ ...q.values });
      d.writes.push({ table, op: "upsert", values: q.values });
      return { data: null, error: null };
    }
    return { data: rows().filter((r) => match(r, q.filters)), error: null };
  };
  const api = {
    select() { return api; },
    eq(c, v) { q.filters[c] = v; return api; },
    limit() { return api; },
    update(v) { q.op = "update"; q.values = v; return api; },
    insert(v) { q.op = "insert"; q.values = v; return api; },
    upsert(v, o) { q.op = "upsert"; q.values = v; q.opts = o; return api; },
    async maybeSingle() { const r = run(); return r.error ? r : { data: (r.data ?? [])[0] ?? null, error: null }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
const client = { from: query };
export function createSupabaseAdminClient() { return client; }
export async function createSupabaseServerClient() { return client; }
`;
const FAKES = {
  "server-only": "",
  react: "export const cache = (f) => f;",
  "next/cache": "export function revalidatePath(p) { globalThis.__adm.revalidated.push(p); }",
  "next/headers": "export async function cookies() { return { get() {}, set() {} }; } export async function headers() { return new Map(); }",
  "@/lib/supabase/admin": FAKE_SUPABASE,
  "@/lib/supabase/server": FAKE_SUPABASE,
  "@/lib/auth/session": "export async function getSessionUser() { return globalThis.__adm.user; }",
  "@/server/notifications/notify": "export async function notifyInvite() {}",
  "@/lib/http": "export async function getRequestOrigin() { return 'http://localhost'; }",
  "@/server/rate-limit": "export function hashIp() { return null; } export async function hitRateLimit() { return 'ok'; } export async function requestIp() { return null; }",
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
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
      }
    }
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

const { setQuickQueueEnabled } = await import("@/features/quick-queue/admin-actions");
const { regenerateTotemToken } = await import("@/features/queue/totem-actions");
const { QUICK_QUEUE_ADMIN_MESSAGES } = await import("@/features/quick-queue/types");

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN_A = "00000000-0000-4000-8000-0000000000a1";
const PAST = "2026-01-01T00:00:00Z";

function setDb({ role = "UNIT_ADMIN", tenantId = A, plan = "essencial", queue = true, enabled = false, settings = {}, tenant = {}, fail = [] } = {}) {
  const t = (id, slug) => ({ id, subdomain: slug, kind: "BARBERSHOP", saas_plan: plan, queue_enabled: queue, quick_queue_enabled: enabled, totem_token: `tok-${slug}`, totem_key_rotated_at: null, ...tenant });
  globalThis.__adm = {
    user: role ? { id: ADMIN_A, role, tenantId } : null,
    fail,
    writes: [],
    revalidated: [],
    tables: {
      tenants: [t(A, "barbearia-a"), t(B, "barbearia-b")],
      tenant_settings: [
        { tenant_id: A, queue_mode: "APP", ...settings },
        { tenant_id: B, queue_mode: "APP" },
      ],
      tenant_contracts: [
        { tenant_id: A, trial_ends_at: PAST },
        { tenant_id: B, trial_ends_at: PAST },
      ],
      audit_log: [],
    },
  };
}
const db = () => globalThis.__adm;
const tenant = (id) => db().tables.tenants.find((t) => t.id === id);
const settings = (id) => db().tables.tenant_settings.find((s) => s.tenant_id === id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---- #103: ligar exige chave renovada depois do início da adoção -------------------------------
await test("ligar sem renovação: ROTATE_FIRST, fila rápida segue desligada e a adoção começa", async () => {
  setDb();
  const r = await setQuickQueueEnabled(true);
  assert.deepEqual(r, { ok: false, code: "ROTATE_FIRST", error: QUICK_QUEUE_ADMIN_MESSAGES.rotateFirst });
  assert.equal(tenant(A).quick_queue_enabled, false);
  assert.ok(settings(A).quick_queue_adoption_started_at);
  assert.equal(db().tables.audit_log.length, 0);
});

await test("renovar depois do início da adoção: ligar passa e fica registrado", async () => {
  setDb();
  await setQuickQueueEnabled(true); // começa a adoção
  await sleep(5);
  const rot = await regenerateTotemToken();
  assert.equal(rot.ok, true);
  const r = await setQuickQueueEnabled(true);
  assert.deepEqual(r, { ok: true, enabled: true });
  assert.equal(tenant(A).quick_queue_enabled, true);
  assert.deepEqual(db().tables.audit_log.map((a) => a.action), ["totem.key_rotated", "quick_queue.enabled"]);
});

await test("renovação ANTES do início da adoção não vale: precisa renovar de novo", async () => {
  setDb({ tenant: { totem_key_rotated_at: "2026-11-01T00:00:00Z" } });
  const r = await setQuickQueueEnabled(true);
  assert.equal(r.ok, false);
  assert.equal(r.code, "ROTATE_FIRST");
  // Adoção registrada antes; renovação mais antiga que ela também é recusada.
  setDb({ settings: { quick_queue_adoption_started_at: "2026-11-10T00:00:00Z" }, tenant: { totem_key_rotated_at: "2026-11-09T00:00:00Z" } });
  assert.equal((await setQuickQueueEnabled(true)).code, "ROTATE_FIRST");
  assert.equal(tenant(A).quick_queue_enabled, false);
});

await test("desligar é sempre permitido, mesmo sem renovação", async () => {
  setDb({ enabled: true });
  assert.deepEqual(await setQuickQueueEnabled(false), { ok: true, enabled: false });
  assert.equal(tenant(A).quick_queue_enabled, false);
});

await test("plano sem fila e fila desativada vêm antes da regra da chave", async () => {
  setDb({ plan: "personal" });
  assert.equal((await setQuickQueueEnabled(true)).code, "PLAN");
  setDb({ queue: false });
  assert.equal((await setQuickQueueEnabled(true)).code, "QUEUE_OFF");
  assert.equal(settings(A).quick_queue_adoption_started_at, undefined);
});

await test("leitura da adoção com erro: falha fechado (GENERIC, nada muda)", async () => {
  setDb({ fail: ["tenant_settings:upsert"] });
  assert.equal((await setQuickQueueEnabled(true)).code, "GENERIC");
  assert.equal(tenant(A).quick_queue_enabled, false);
});

// ---- #103: renovar a chave -------------------------------------------------------------------
await test("renovar: chave nova longa, anterior deixa de valer, registra quem e quando, sem a chave no registro", async () => {
  setDb();
  const before = tenant(A).totem_token;
  const r = await regenerateTotemToken();
  assert.equal(r.ok, true);
  assert.match(r.token, /^[0-9a-f]{64}$/);
  assert.notEqual(tenant(A).totem_token, before);
  assert.equal(tenant(A).totem_token, r.token);
  assert.equal(tenant(A).totem_key_rotated_by, ADMIN_A);
  assert.ok(tenant(A).totem_key_rotated_at);
  const log = db().tables.audit_log[0];
  assert.equal(log.action, "totem.key_rotated");
  assert.equal(log.user_id, ADMIN_A);
  assert.doesNotMatch(JSON.stringify(log), new RegExp(r.token));
  assert.equal(tenant(B).totem_token, "tok-barbearia-b");
});

await test("renovar mexe só em tenants da própria barbearia (nenhuma escrita em senha)", async () => {
  setDb();
  await regenerateTotemToken();
  const tables = new Set(db().writes.map((w) => w.table));
  assert.deepEqual([...tables].sort(), ["audit_log", "tenants"]);
  const upd = db().writes.find((w) => w.table === "tenants");
  assert.deepEqual(upd.filters, { id: A });
});

await test("cliente, sem sessão ou admin de outra barbearia: não renova nem liga a desta", async () => {
  setDb({ role: "CLIENT" });
  assert.equal((await regenerateTotemToken()).ok, false);
  assert.equal((await setQuickQueueEnabled(true)).code, "FORBIDDEN");
  setDb({ role: null });
  assert.equal((await regenerateTotemToken()).ok, false);
  assert.equal((await setQuickQueueEnabled(true)).code, "FORBIDDEN");
  setDb({ tenantId: B }); // admin da B: só alcança a B
  await regenerateTotemToken();
  assert.equal(tenant(A).totem_token, "tok-barbearia-a");
  assert.equal(tenant(A).totem_key_rotated_at, null);
});

await test("a chave não aparece no registro, no QR do cliente nem na página pública", () => {
  const pub = [
    "src/app/b/[slug]/fila/route.ts",
    "src/app/b/[slug]/fila/rapida/page.tsx",
    "src/app/b/[slug]/totem/page.tsx",
  ].map((f) => readFileSync(path.join(ROOT, f), "utf8"));
  for (const src of pub.slice(0, 2)) assert.doesNotMatch(src, /totem_token|totemToken|getTotemToken/);
  const actions = readFileSync(path.join(SRC, "features/queue/totem-actions.ts"), "utf8");
  const fn = actions.slice(actions.indexOf("export async function regenerateTotemToken"));
  const audit = fn.slice(fn.indexOf('from("audit_log")'), fn.indexOf("});", fn.indexOf('from("audit_log")')));
  // Único "token" permitido no registro é o nome da coluna em target; nunca o valor.
  assert.doesNotMatch(audit.replace('"tenants.totem_token"', ""), /token/i);
  assert.match(audit, /metadata: \{\}/);
  assert.doesNotMatch(fn, /console\.[a-z]+\([^)]*token/);
});

console.log(`\n${passed} testes ok`);

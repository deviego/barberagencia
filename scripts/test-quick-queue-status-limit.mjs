// Testes do #148, sem rede e sem banco: teto de consultas sem credencial conferida na rota de
// status (antes de qualquer leitura no banco) e despachante /b/<slug>/fila levando a "Minha senha"
// quando o aparelho tem senha ativa. As rotas de verdade rodam com dublês de guard, credencial,
// leituras e NextResponse. Dados fictícios.
// Roda com: node scripts/test-quick-queue-status-limit.mjs
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const g = () => globalThis.__sl;

const FAKES = {
  "server-only": "",
  "next/server": `export const NextResponse = {
    json(body, init) { return { body, status: init?.status ?? 200 }; },
    redirect(url) { const r = { redirect: String(url), cookies: { set() {} } }; return r; },
  };`,
  "@/lib/supabase/admin": "export function createSupabaseAdminClient() { return {}; }",
  "@/features/quick-queue/guard": `
    export class QuickQueueClosedError extends Error {}
    export async function requireQuickQueueTicketAccess(slug) { globalThis.__sl.db.push("guard:" + slug); return { tenantId: "t-" + slug }; }`,
  "@/features/quick-queue/device": `
    export async function readDeviceToken() { return globalThis.__sl.token; }
    export function hashDeviceToken(t) { return "h-" + t; }`,
  "@/features/quick-queue/ticket": `
    export async function claimStatusSlot(_a, tenantId, hash) { globalThis.__sl.db.push("claim:" + hash); return globalThis.__sl.valid.has(hash) ? { deviceId: "d-" + hash } : null; }
    export async function loadDeviceTicket() { return null; }
    export async function loadSnapshot() { return { nowServing: null, waiting: [] }; }`,
  "@/lib/tenant/resolve": `
    export const TENANT_COOKIE = "t";
    export async function getTenantBySubdomain(slug) { return { subdomain: slug }; }`,
  "@/features/quick-queue/data": `
    export async function getQuickQueueRoute() { return globalThis.__sl.route; }
    export async function quickQueueDeviceHasTicket() { return globalThis.__sl.hasTicket; }`,
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
    return next(target && existsSync(target) ? pathToFileURL(target).href : specifier, context);
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

const { createWindowCounter, createVerifiedSet } = await import("@/features/quick-queue/status-limit");
const { QUICK_QUEUE_STATUS_LIMITS: SL } = await import("@/features/quick-queue/limits");
const statusRoute = await import(pathToFileURL(path.join(SRC, "app/b/[slug]/fila/rapida/status/route.ts")).href);
const dispatcher = await import(pathToFileURL(path.join(SRC, "app/b/[slug]/fila/route.ts")).href);

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
const reset = (over = {}) => (globalThis.__sl = { token: null, valid: new Set(), db: [], route: "LEGACY", hasTicket: false, ...over });
const status = (slug) => statusRoute.GET(new Request(`http://localhost/b/${slug}/fila/rapida/status`), { params: Promise.resolve({ slug }) });

// ---- Contadores puros --------------------------------------------------------------------------
await test("contador por janela: cabe até o teto, recusa depois e volta na janela seguinte", () => {
  const c = createWindowCounter(3, 1000);
  assert.deepEqual([c.hit("a", 0), c.hit("a", 1), c.hit("a", 2), c.hit("a", 3)], [true, true, true, false]);
  assert.equal(c.hit("b", 3), true, "outra barbearia não sente");
  assert.equal(c.hit("a", 1000), true);
});

await test("contador com limite de memória: muitas chaves não crescem sem fim", () => {
  const c = createWindowCounter(1, 1000, 3);
  for (const k of ["a", "b", "c", "d"]) c.hit(k, 0);
  assert.equal(c.hit("a", 0), true, "mapa foi limpo ao passar do limite de chaves");
});

await test("conferidos: valem até a validade e saem quando removidos", () => {
  const v = createVerifiedSet(100);
  v.add("x", 0);
  assert.equal(v.has("x", 50), true);
  assert.equal(v.has("x", 100), false);
  v.add("y", 0);
  v.delete("y");
  assert.equal(v.has("y", 1), false);
});

// ---- Rota de status ---------------------------------------------------------------------------
await test("sem credencial: acima do teto responde 429 LIMIT sem tocar no banco", async () => {
  reset();
  const slug = "barbearia-sem-cookie";
  for (let i = 0; i < SL.unverifiedPerShop; i++) assert.equal((await status(slug)).status, 200);
  const before = g().db.length;
  const r = await status(slug);
  assert.deepEqual([r.status, r.body], [429, { ok: false, code: "LIMIT" }]);
  assert.equal(g().db.length, before, "nenhuma leitura depois do teto");
});

await test("credencial inventada conta no mesmo teto da barbearia", async () => {
  reset({ token: "inventada" });
  const slug = "barbearia-inventada";
  for (let i = 0; i < SL.unverifiedPerShop; i++) assert.equal((await status(slug)).body.ticket, null);
  assert.equal((await status(slug)).status, 429);
});

await test("aparelho conferido não entra no teto de não conferidos", async () => {
  const slug = "barbearia-valida";
  reset({ token: "boa", valid: new Set(["h-boa"]) });
  await status(slug); // confere uma vez
  g().token = null;
  for (let i = 0; i < SL.unverifiedPerShop; i++) await status(slug); // esgota o teto com visitantes
  assert.equal((await status(slug)).status, 429);
  g().token = "boa";
  const r = await status(slug);
  assert.equal(r.status, 200, "o cliente com senha continua consultando");
});

await test("liberação vale só para a barbearia em que a credencial foi conferida", async () => {
  reset({ token: "boa", valid: new Set(["h-boa"]) });
  await status("barbearia-x");
  g().valid = new Set(); // em outra barbearia a credencial não vale
  for (let i = 0; i < SL.unverifiedPerShop; i++) await status("barbearia-y");
  assert.equal((await status("barbearia-y")).status, 429);
});

await test("endereço fora do formato não vira chave do contador", () => {
  const src = readFileSync(path.join(SRC, "app/b/[slug]/fila/rapida/status/route.ts"), "utf8");
  const limiter = src.indexOf("unverified.hit(slug)");
  assert.ok(limiter > 0);
  assert.ok(src.lastIndexOf("isQuickQueueSlug(slug)", limiter) > 0);
  assert.ok(limiter < src.indexOf("requireQuickQueueTicketAccess(slug)"), "teto antes do guard");
  assert.ok(limiter < src.indexOf("claimStatusSlot("), "teto antes do banco");
  assert.match(src, /`\$\{slug\}:\$\{deviceHash\}`/);
});

// ---- Despachante ------------------------------------------------------------------------------
const dispatch = (slug) => dispatcher.GET(new Request(`http://localhost/b/${slug}/fila`), { params: Promise.resolve({ slug }) });

await test("fila rápida desligada + senha ativa neste aparelho: abre a fila rápida (Minha senha)", async () => {
  reset({ route: "LEGACY", hasTicket: true });
  assert.equal((await dispatch("barbearia-a")).redirect, "http://localhost/b/barbearia-a/fila/rapida");
});

await test("fila rápida desligada sem senha: fila com login, como antes", async () => {
  reset({ route: "LEGACY", hasTicket: false });
  assert.equal((await dispatch("barbearia-a")).redirect, "http://localhost/client/fila");
});

await test("fila rápida ligada: fila rápida", async () => {
  reset({ route: "QUICK", hasTicket: false });
  assert.equal((await dispatch("barbearia-a")).redirect, "http://localhost/b/barbearia-a/fila/rapida");
});

console.log(`\n${passed} testes ok`);

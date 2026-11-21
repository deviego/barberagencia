// Testes da identificação da fila rápida (#96) sem banco: regra de telefone, nome e as ações
// identifyPhone/registerName com guard, cookie e RPC falsos. Dados fictícios.
// Roda com: node scripts/test-quick-queue-identify.mjs  (Node 23.6+ remove tipos do .ts sozinho)
// O comportamento da função de banco (concorrência, limites, permissões) está em
// scripts/test-quick-queue-identify-db.mjs, que roda num Supabase local descartável.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

const FAKE_HEADERS = `
export async function cookies() {
  const s = globalThis.__qi.cookies;
  return {
    get: (name) => (s.has(name) ? { name, value: s.get(name).value } : undefined),
    set: (name, value, opts) => { s.set(name, { value, opts }); },
  };
}`;
const FAKE_ADMIN = `
export function createSupabaseAdminClient() {
  return {
    async rpc(fn, args) {
      const q = globalThis.__qi;
      q.rpcCalls.push({ fn, args });
      return q.rpcReply(args);
    },
  };
}`;
const FAKE_GUARD = `
export class QuickQueueClosedError extends Error {
  constructor() { super("A fila não está disponível agora. Fale no balcão."); this.name = "QuickQueueClosedError"; }
}
export async function requireQuickQueueOpen(slug) {
  const q = globalThis.__qi;
  q.guardCalls.push(slug);
  if (q.guard === "closed") throw new QuickQueueClosedError();
  if (q.guard === "error") throw new Error("leitura indisponível");
  return { tenantId: "00000000-0000-4000-8000-0000000000aa" };
}
// "Sair da fila" usa o guard da senha já criada (#102); fora do escopo deste teste.
export async function requireQuickQueueTicketAccess(slug) {
  return requireQuickQueueOpen(slug);
}`;
const data = (src) => "data:text/javascript," + encodeURIComponent(src);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "next/headers") return { url: data(FAKE_HEADERS), shortCircuit: true };
    if (specifier === "@/lib/supabase/admin") return { url: data(FAKE_ADMIN), shortCircuit: true };
    if (specifier === "./guard" && context.parentURL?.endsWith("/quick-queue/actions.ts")) {
      return { url: data(FAKE_GUARD), shortCircuit: true };
    }
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
});

const { phoneKey, formatPhoneKey } = await import("@/lib/phone");
const { quickQueueName } = await import("@/features/quick-queue/schema");
const { identifyPhone, registerName } = await import("@/features/quick-queue/actions");
const { QUICK_QUEUE_IDENTIFY_MESSAGES: MSG } = await import("@/features/quick-queue/types");

function reset({ guard = "open", reply = { result: "NEED_NAME", new_device: true }, cookie = null } = {}) {
  globalThis.__qi = {
    guard,
    guardCalls: [],
    rpcCalls: [],
    cookies: new Map(cookie ? [["bb_qq", { value: cookie, opts: {} }]] : []),
    rpcReply: typeof reply === "function" ? reply : () => ({ data: [reply], error: null }),
  };
  return globalThis.__qi;
}

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

// ---------- regra de telefone ----------

await test("telefone: máscara, +55 e 0 na frente viram a mesma chave", () => {
  const same = ["21987650001", "(21) 98765-0001", "+55 (21) 98765-0001", "5521987650001", "021987650001", "21 9 8765 0001", " (21)98765.0001 "];
  for (const v of same) assert.equal(phoneKey(v), "21987650001", v);
  assert.equal(phoneKey("(11) 3333-4444"), "1133334444");
  assert.equal(phoneKey("+55 11 3333-4444"), "1133334444");
  // 0 de discagem antes de um fixo: 11 dígitos começando com 0.
  assert.equal(phoneKey("021 3333-4444"), "2133334444");
  // Ambiguidade conhecida: "(01) 98765-0001" (DDD errado) também vira um fixo válido (19) 8765-0001.
  assert.equal(phoneKey("(01) 98765-0001"), "1987650001");
  // DDD 55 (RS) com celular de 11 dígitos não perde o DDD.
  assert.equal(phoneKey("(55) 99999-1234"), "55999991234");
});

await test("telefone: incompleto, sem DDD, com letras ou fora da regra é recusado", () => {
  for (const v of ["", "abc", "98765-0001", "(21) 8765-000", "(21) 88765-0001", "(21) 9876-0001", "(01) 8765-0001",
    "(10) 98765-0001", "219876500011", "+1 415 555 0000", "21 98765-0001 ramal 2", "9".repeat(41), null, undefined, 21987650001]) {
    assert.equal(phoneKey(v), null, String(v));
  }
});

await test("telefone: formato gravado sai da chave", () => {
  assert.equal(formatPhoneKey("21987650001"), "(21) 98765-0001");
  assert.equal(formatPhoneKey("1133334444"), "(11) 3333-4444");
});

// ---------- nome ----------

await test("nome: aceita acento, apóstrofo, hífen e abreviação; normaliza espaços", () => {
  assert.deepEqual(quickQueueName("  João   da Silva "), { ok: true, name: "João da Silva" });
  assert.deepEqual(quickQueueName("D’Ávila Jr."), { ok: true, name: "D'Ávila Jr." });
  assert.deepEqual(quickQueueName("Ana-Clara"), { ok: true, name: "Ana-Clara" });
  assert.deepEqual(quickQueueName("Sra. Ana"), { ok: true, name: "Sra. Ana" });
  assert.deepEqual(quickQueueName("Lu"), { ok: true, name: "Lu" });
});

await test("nome: vazio, curto ou longo pede o nome; número, link, HTML ou símbolo pede só letras", () => {
  for (const v of ["", "   ", "A", "x".repeat(61), null, 5]) assert.deepEqual(quickQueueName(v), { ok: false, reason: "empty" }, String(v));
  for (const v of ["Ana 2", "<b>Ana</b>", "ana.com", "http://x", "Ana\nSilva", "Ana\tSilva", "ana@x", "Ana 😀", ".Ana", "a.b"]) {
    assert.deepEqual(quickQueueName(v), { ok: false, reason: "chars" }, JSON.stringify(v));
  }
});

// ---------- ações ----------

await test("identifyPhone: telefone inválido não chega ao banco", async () => {
  for (const v of ["", "123", "abc", "x".repeat(50)]) {
    const q = reset();
    assert.deepEqual(await identifyPhone("barbearia-teste", v), { ok: false, error: MSG.invalidPhone, field: "phone" });
    assert.equal(q.rpcCalls.length, 0);
  }
});

await test("identifyPhone: manda só a chave do telefone e a barbearia resolvida pelo guard", async () => {
  const q = reset();
  assert.deepEqual(await identifyPhone("barbearia-teste", "+55 (21) 98765-0001"), { ok: true, next: "NAME" });
  assert.deepEqual(q.guardCalls, ["barbearia-teste"]);
  const args = q.rpcCalls[0].args;
  assert.equal(q.rpcCalls[0].fn, "quick_queue_identify");
  assert.equal(args.p_tenant_id, "00000000-0000-4000-8000-0000000000aa");
  assert.equal(args.p_phone_key, "21987650001");
  assert.equal(args.p_name, null);
  assert.equal(args.p_device_hash, null);
  assert.match(args.p_new_device_hash, /^[0-9a-f]{64}$/);
});

await test("identifyPhone: credencial nova vai para cookie HttpOnly, restrito à fila da barbearia; o banco recebe só o resumo", async () => {
  const q = reset();
  await identifyPhone("barbearia-teste", "21987650001");
  const c = q.cookies.get("bb_qq");
  assert.match(c.value, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(c.opts.httpOnly, true);
  assert.equal(c.opts.secure, true);
  assert.equal(c.opts.sameSite, "lax");
  assert.equal(c.opts.path, "/b/barbearia-teste/fila");
  assert.equal(c.opts.maxAge, 30 * 24 * 60 * 60);
  const sent = JSON.stringify(q.rpcCalls[0].args);
  assert.ok(!sent.includes(c.value), "o valor da credencial não vai ao banco");
});

await test("identifyPhone: aparelho com credencial manda o resumo dela e renova o cookie", async () => {
  const token = "A".repeat(43);
  const q = reset({ cookie: token, reply: { result: "KNOWN", new_device: false } });
  assert.deepEqual(await identifyPhone("barbearia-teste", "21987650001"), { ok: true, next: "SERVICE" });
  assert.match(q.rpcCalls[0].args.p_device_hash, /^[0-9a-f]{64}$/);
  assert.equal(q.cookies.get("bb_qq").value, token);
});

await test("identifyPhone: cookie com formato estranho é ignorado (credencial nova)", async () => {
  const q = reset({ cookie: "../../etc" });
  await identifyPhone("barbearia-teste", "21987650001");
  assert.equal(q.rpcCalls[0].args.p_device_hash, null);
});

await test("respostas só trazem o próximo passo: nada de id, nome ou telefone", async () => {
  for (const result of ["KNOWN", "NEED_NAME"]) {
    reset({ reply: { result, new_device: false } });
    const r = await identifyPhone("barbearia-teste", "21987650001");
    assert.deepEqual(Object.keys(r).sort(), ["next", "ok"]);
  }
  reset({ cookie: "B".repeat(43), reply: { result: "CREATED", new_device: false } });
  const r = await registerName("barbearia-teste", "Ana Teste");
  assert.deepEqual(r, { ok: true, next: "SERVICE" });
});

await test("limite, chave inválida, fila desligada e erro do banco viram mensagens fixas", async () => {
  const cases = [
    ["LIMIT", { ok: false, error: MSG.limited }],
    ["INVALID", { ok: false, error: MSG.invalidPhone, field: "phone" }],
    ["CLOSED", { ok: false, error: "A fila não está disponível agora. Fale no balcão." }],
    ["???", { ok: false, error: MSG.failed }],
  ];
  for (const [result, expected] of cases) {
    reset({ reply: { result, new_device: false } });
    assert.deepEqual(await identifyPhone("barbearia-teste", "21987650001"), expected, result);
  }
  reset({ reply: () => ({ data: null, error: { code: "PGRST202", message: "21987650001 Ana" } }) });
  assert.deepEqual(await identifyPhone("barbearia-teste", "21987650001"), { ok: false, error: MSG.failed });
});

await test("#148: tetos da barbearia dão o mesmo aviso ao cliente e entram na contagem com tipo próprio", async () => {
  const cases = [
    ["LIMIT", "IDENTIFY"],
    ["TENANT_ATTEMPTS", "IDENTIFY_TENANT"],
    ["TENANT_NEW_DEVICES", "NEW_DEVICES_TENANT"],
    ["TENANT_NEW_CLIENTS", "NEW_CLIENTS_TENANT"],
  ];
  for (const [result, kind] of cases) {
    let q = reset({ reply: (args) => ({ data: args?.p_kind ? null : [{ result, new_device: false }], error: null }) });
    assert.deepEqual(await identifyPhone("barbearia-teste", "21987650001"), { ok: false, error: MSG.limited }, result);
    const rec = q.rpcCalls.filter((c) => c.fn === "quick_queue_record_limit");
    assert.deepEqual(rec.map((c) => c.args.p_kind), [kind], result);
    q = reset({ cookie: "B".repeat(43), reply: (args) => ({ data: args?.p_kind ? null : [{ result, new_device: false }], error: null }) });
    assert.deepEqual(await registerName("barbearia-teste", "Ana Teste"), { ok: false, error: MSG.limited }, result);
  }
});

await test("guard: fila fechada ou leitura com erro recusam antes do banco", async () => {
  let q = reset({ guard: "closed" });
  assert.deepEqual(await identifyPhone("barbearia-teste", "21987650001"), {
    ok: false,
    error: "A fila não está disponível agora. Fale no balcão.",
  });
  assert.equal(q.rpcCalls.length, 0);
  q = reset({ guard: "error" });
  assert.deepEqual(await registerName("barbearia-teste", "Ana Teste"), { ok: false, error: MSG.failed });
  assert.equal(q.rpcCalls.length, 0);
});

await test("registerName: nome inválido não chega ao banco; mensagem certa para cada motivo", async () => {
  let q = reset({ cookie: "C".repeat(43) });
  assert.deepEqual(await registerName("barbearia-teste", "A"), { ok: false, error: MSG.invalidName, field: "name" });
  assert.deepEqual(await registerName("barbearia-teste", "Ana <b>"), { ok: false, error: MSG.nameLettersOnly, field: "name" });
  assert.equal(q.rpcCalls.length, 0);
  q = reset({ cookie: "C".repeat(43), reply: { result: "INVALID", new_device: false } });
  assert.deepEqual(await registerName("barbearia-teste", "Ana Teste"), { ok: false, error: MSG.invalidName, field: "name" });
});

await test("registerName: manda o nome limpo, sem telefone, e nunca emite credencial nova", async () => {
  const q = reset({ cookie: "D".repeat(43), reply: { result: "CREATED", new_device: false } });
  await registerName("barbearia-teste", "  Ana   Teste ");
  const a = q.rpcCalls[0].args;
  assert.equal(a.p_name, "Ana Teste");
  assert.equal(a.p_phone_key, null);
  assert.equal(a.p_new_device_hash, null);
});

await test("registerName: sem o passo do telefone neste aparelho volta ao telefone (restart)", async () => {
  reset({ reply: { result: "NO_PENDING", new_device: false } });
  assert.deepEqual(await registerName("barbearia-teste", "Ana Teste"), { ok: false, error: MSG.restart, restart: true });
});

await test("registerName: telefone cadastrado por outro caminho entre os passos segue para o serviço", async () => {
  reset({ cookie: "E".repeat(43), reply: { result: "KNOWN", new_device: false } });
  assert.deepEqual(await registerName("barbearia-teste", "Ana Teste"), { ok: true, next: "SERVICE" });
});

await test("logs nunca levam telefone, nome ou credencial", async () => {
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try {
    reset({ reply: () => ({ data: null, error: { code: "XX000", message: "falhou 21987650001 Ana" } }) });
    await identifyPhone("barbearia-teste", "21987650001");
    reset({ guard: "error", cookie: "F".repeat(43) });
    await registerName("barbearia-teste", "Ana Teste");
  } finally {
    console.error = orig;
  }
  assert.ok(logged.length >= 2);
  for (const l of logged) {
    assert.ok(!/\d{8,}/.test(l) && !l.includes("Ana") && !l.includes("FFFF"), l);
  }
});

console.log(`\n${passed} testes ok`);

// Testes da entrada da fila rápida (#95), sem rede e sem banco. Dados fictícios.
// Roda com: node scripts/test-quick-queue-guard.mjs  (os .ts são transpilados com o typescript do projeto)
import { registerHooks } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

// Banco falso: o teste preenche globalThis.__qq e o cliente do Supabase responde a partir dele.
const FAKE_SUPABASE = `
const db = () => globalThis.__qq;
function query(table) {
  const q = { table, cols: "", filters: {} };
  const api = {
    select(cols) { q.cols = cols; return api; },
    eq(col, val) { q.filters[col] = val; return api; },
    limit() { return api; },
    async maybeSingle() {
      const d = db();
      d.reads.push(q.table + ":" + q.cols);
      if (q.table === "tenants" && q.cols.includes("quick_queue_enabled") && d.noColumn) {
        return { data: null, error: { code: "42703" } };
      }
      if (d.failTables?.includes(q.table)) return { data: null, error: { code: "XX000" } };
      const rows = d.tables[q.table] ?? [];
      const row = rows.find((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v)) ?? null;
      return { data: row, error: null };
    },
    then(res, rej) {
      const d = db();
      d.reads.push(q.table + ":" + q.cols);
      const rows = (d.tables[q.table] ?? []).filter((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v));
      return Promise.resolve({ data: rows, error: null }).then(res, rej);
    },
  };
  return api;
}
const client = {
  from: query,
  auth: { async getUser() { db().reads.push("auth"); return { data: { user: db().user } }; } },
};
export function createSupabaseAdminClient() { return client; }
export async function createSupabaseServerClient() { return client; }
`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "react") return { url: "data:text/javascript,export const cache = (f) => f;", shortCircuit: true };
    // Cookie da credencial do aparelho (#98): estes testes rodam sempre sem credencial.
    if (specifier === "next/headers") {
      return {
        url: "data:text/javascript," + encodeURIComponent("export async function cookies() { return { get() {}, set() {} }; }"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/supabase/admin" || specifier === "@/lib/supabase/server") {
      return { url: "data:text/javascript," + encodeURIComponent(FAKE_SUPABASE), shortCircuit: true };
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
  // src/lib/entitlements.ts usa "parameter property", que a remoção de tipos do Node não aceita.
  load(url, context, next) {
    if (!url.startsWith("file:") || !url.endsWith(".ts")) return next(url, context);
    const source = readFileSync(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});

const rules = await import("@/features/quick-queue/rules");
const { getQuickQueueEntry, getQuickQueueRoute } = await import("@/features/quick-queue/data");
const { requireQuickQueueOpen, QuickQueueClosedError } = await import("@/features/quick-queue/guard");
const { QUICK_QUEUE_MESSAGES } = await import("@/features/quick-queue/types");

const NOW = new Date("2026-11-17T12:00:00Z");
const PAST = "2026-01-01T00:00:00Z";
const FUTURE = "2027-01-01T00:00:00Z";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

/** Barbearia fictícia aberta: Essencial, teste acabado, fila no modo APP, fila rápida ligada. */
function shop(id, slug, over = {}) {
  return {
    tenant: { id, subdomain: slug, name: `Barbearia Teste ${slug}`, kind: "BARBERSHOP", saas_plan: "essencial", queue_enabled: true, quick_queue_enabled: true, ...over.tenant },
    settings: { tenant_id: id, queue_mode: "APP", ...over.settings },
    contract: { tenant_id: id, trial_ends_at: PAST, ...over.contract },
    branding: { tenant_id: id, logo_text: "BT", logo_url: null, accent: "#123456", accent_hover: null, accent_down: null, accent_wash: null, focus: null },
  };
}

function setDb(shops, { user = null, memberships = [], noColumn = false, failTables = [] } = {}) {
  globalThis.__qq = {
    noColumn,
    failTables,
    user,
    reads: [],
    tables: {
      tenants: shops.map((s) => s.tenant),
      tenant_settings: shops.map((s) => s.settings),
      tenant_contracts: shops.map((s) => s.contract),
      branding: shops.map((s) => s.branding),
      memberships,
    },
  };
}

const state = (over = {}) => ({
  id: A,
  kind: "BARBERSHOP",
  saasPlan: "essencial",
  trialEndsAt: PAST,
  queueEnabled: true,
  queueMode: "APP",
  quickQueueEnabled: true,
  readFailed: false,
  ...over,
});

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

// ---------- regras puras ----------

await test("status: inexistente e distribuidor são NOT_FOUND", () => {
  assert.equal(rules.quickQueueStatus(null, NOW), "NOT_FOUND");
  assert.equal(rules.quickQueueStatus(state({ kind: "DISTRIBUTOR" }), NOW), "NOT_FOUND");
});

await test("status: aberta só com fila rápida ligada, plano com fila e fila recebendo pelo link", () => {
  assert.equal(rules.quickQueueStatus(state(), NOW), "OPEN");
  assert.equal(rules.quickQueueStatus(state({ queueMode: "BOTH" }), NOW), "OPEN");
  assert.equal(rules.quickQueueStatus(state({ saasPlan: "advance" }), NOW), "OPEN");
  assert.equal(rules.quickQueueStatus(state({ quickQueueEnabled: false }), NOW), "UNAVAILABLE");
  assert.equal(rules.quickQueueStatus(state({ queueEnabled: false }), NOW), "UNAVAILABLE");
  assert.equal(rules.quickQueueStatus(state({ queueMode: "TOTEM" }), NOW), "UNAVAILABLE");
  assert.equal(rules.quickQueueStatus(state({ readFailed: true }), NOW), "UNAVAILABLE");
});

await test("plano: Personal sem fila depois do teste; durante o teste segue a regra do painel (liberado)", () => {
  assert.equal(rules.quickQueueStatus(state({ saasPlan: "personal" }), NOW), "UNAVAILABLE");
  assert.equal(rules.quickQueueStatus(state({ saasPlan: "personal", trialEndsAt: FUTURE }), NOW), "OPEN");
  assert.equal(rules.planAllowsQueue({ saasPlan: "personal", trialEndsAt: PAST }, NOW), false);
  assert.equal(rules.planAllowsQueue({ saasPlan: "essencial", trialEndsAt: PAST }, NOW), true);
});

await test("despachante: só a chave da fila rápida leva para a jornada nova", () => {
  assert.equal(rules.quickQueueRoute(null), "LEGACY");
  assert.equal(rules.quickQueueRoute(state({ quickQueueEnabled: false })), "LEGACY");
  assert.equal(rules.quickQueueRoute(state({ kind: "DISTRIBUTOR" })), "LEGACY");
  assert.equal(rules.quickQueueRoute(state()), "QUICK");
  // Ligada mas fechada: vai para a jornada nova, que mostra o aviso.
  assert.equal(rules.quickQueueRoute(state({ queueMode: "TOTEM" })), "QUICK");
});

await test("viewer: cliente de outra barbearia é visitante", () => {
  assert.equal(rules.quickQueueViewer([], A), "VISITOR");
  assert.equal(rules.quickQueueViewer([B], A), "VISITOR");
  assert.equal(rules.quickQueueViewer([A], A), "CLIENT");
  assert.equal(rules.quickQueueViewer([B, A], A), "CLIENT");
});

await test("endereço: só slug simples vai ao banco", () => {
  for (const ok of ["barbearia-teste", "bt01", "a"]) assert.equal(rules.isQuickQueueSlug(ok), true, ok);
  for (const bad of ["", "Barbearia", "a b", "../x", "a/b", "a.b", "x".repeat(64), null, undefined, 1, "%00"]) {
    assert.equal(rules.isQuickQueueSlug(bad), false, String(bad));
  }
});

// ---------- leitura (banco falso) ----------

await test("entrada OPEN traz só a marca; nada de plano, fila, configuração ou id", async () => {
  setDb([shop(A, "barbearia-a")]);
  const e = await getQuickQueueEntry("barbearia-a");
  assert.equal(e.status, "OPEN");
  assert.equal(e.viewer, "VISITOR");
  assert.deepEqual(Object.keys(e).sort(), ["brand", "status", "viewer"]);
  assert.deepEqual(Object.keys(e.brand).sort(), ["accent", "accentDown", "accentHover", "accentWash", "focus", "logoText", "logoUrl", "name"]);
  assert.equal(e.brand.name, "Barbearia Teste barbearia-a");
  assert.ok(!JSON.stringify(e).includes(A), "não pode levar o id da barbearia");
});

await test("inexistente, sem plano, desligada e fechada: resposta sem dado e sem olhar a sessão", async () => {
  const cases = [
    ["nao-existe", [], "NOT_FOUND"],
    ["../x", [], "NOT_FOUND"],
    ["dist", [shop(A, "dist", { tenant: { kind: "DISTRIBUTOR" } })], "NOT_FOUND"],
    ["sem-plano", [shop(A, "sem-plano", { tenant: { saas_plan: "personal" } })], "UNAVAILABLE"],
    ["desligada", [shop(A, "desligada", { tenant: { quick_queue_enabled: false } })], "UNAVAILABLE"],
    ["fila-off", [shop(A, "fila-off", { tenant: { queue_enabled: false } })], "UNAVAILABLE"],
    ["so-totem", [shop(A, "so-totem", { settings: { queue_mode: "TOTEM" } })], "UNAVAILABLE"],
  ];
  for (const [slug, shops, expected] of cases) {
    setDb(shops, { user: { id: "u1" }, memberships: [{ user_id: "u1", tenant_id: A, role: "CLIENT" }] });
    const e = await getQuickQueueEntry(slug);
    assert.deepEqual(e, { status: expected, viewer: "VISITOR" }, slug);
    const reads = globalThis.__qq.reads;
    assert.ok(!reads.some((r) => r.startsWith("branding")), `${slug}: não lê a marca`);
    assert.ok(!reads.includes("auth"), `${slug}: não olha a sessão`);
  }
});

await test("endereço inválido nem chega ao banco", async () => {
  setDb([]);
  await getQuickQueueEntry("A B/../x");
  assert.deepEqual(globalThis.__qq.reads, []);
});

await test("sessão: cliente de A abre o link de B e é visitante; cliente de B é CLIENT", async () => {
  const shops = [shop(A, "barbearia-a"), shop(B, "barbearia-b")];
  setDb(shops, { user: { id: "u1" }, memberships: [{ user_id: "u1", tenant_id: A, role: "CLIENT" }] });
  assert.equal((await getQuickQueueEntry("barbearia-b")).viewer, "VISITOR");
  assert.equal((await getQuickQueueEntry("barbearia-a")).viewer, "CLIENT");
  // Equipe da barbearia (não cliente) também é visitante na jornada.
  setDb(shops, { user: { id: "u2" }, memberships: [{ user_id: "u2", tenant_id: B, role: "UNIT_ADMIN" }] });
  assert.equal((await getQuickQueueEntry("barbearia-b")).viewer, "VISITOR");
});

await test("HAS_TICKET ainda não é devolvido (depende da #99)", async () => {
  setDb([shop(A, "barbearia-a")], { user: { id: "u1" }, memberships: [{ user_id: "u1", tenant_id: A, role: "CLIENT" }] });
  assert.notEqual((await getQuickQueueEntry("barbearia-a")).viewer, "HAS_TICKET");
});

await test("sem a schema-51 no banco: fila rápida desligada e o link segue como hoje", async () => {
  setDb([shop(A, "barbearia-a")], { noColumn: true });
  assert.equal(await getQuickQueueRoute("barbearia-a"), "LEGACY");
  assert.deepEqual(await getQuickQueueEntry("barbearia-a"), { status: "UNAVAILABLE", viewer: "VISITOR" });
});

await test("despachante: desligada, inexistente ou leitura com erro = LEGACY", async () => {
  setDb([shop(A, "barbearia-a", { tenant: { quick_queue_enabled: false } })]);
  assert.equal(await getQuickQueueRoute("barbearia-a"), "LEGACY");
  assert.equal(await getQuickQueueRoute("nao-existe"), "LEGACY");
  setDb([shop(A, "barbearia-a")]);
  assert.equal(await getQuickQueueRoute("barbearia-a"), "QUICK");
  globalThis.__qq = null; // qualquer leitura quebra
  assert.equal(await getQuickQueueRoute("barbearia-a"), "LEGACY");
});

// ---------- guard ----------

await test("guard: recusa inexistente, sem plano, desligada e fechada com a mesma mensagem", async () => {
  const cases = [
    ["nao-existe", []],
    ["sem-plano", [shop(A, "sem-plano", { tenant: { saas_plan: "personal" } })]],
    ["desligada", [shop(A, "desligada", { tenant: { quick_queue_enabled: false } })]],
    ["fechada", [shop(A, "fechada", { tenant: { queue_enabled: false } })]],
    ["so-totem", [shop(A, "so-totem", { settings: { queue_mode: "TOTEM" } })]],
  ];
  for (const [slug, shops] of cases) {
    setDb(shops);
    await assert.rejects(requireQuickQueueOpen(slug, NOW), (e) => {
      assert.ok(e instanceof QuickQueueClosedError, slug);
      assert.equal(e.message, QUICK_QUEUE_MESSAGES.unavailable, slug);
      return true;
    });
  }
});

await test("guard: aberta devolve só o id resolvido pelo endereço", async () => {
  setDb([shop(A, "barbearia-a"), shop(B, "barbearia-b")]);
  assert.deepEqual(await requireQuickQueueOpen("barbearia-b", NOW), { tenantId: B });
});

await test("guard: confere a cada chamada (desligar depois de abrir passa a recusar)", async () => {
  const s = shop(A, "barbearia-a");
  setDb([s]);
  await requireQuickQueueOpen("barbearia-a", NOW);
  s.tenant.quick_queue_enabled = false;
  await assert.rejects(requireQuickQueueOpen("barbearia-a", NOW), QuickQueueClosedError);
});

// ---------- falha fechado ----------

for (const table of ["tenant_settings", "tenant_contracts"]) {
  await test(`erro na leitura de ${table}: entrada UNAVAILABLE, sem marca e sem olhar a sessão`, async () => {
    setDb([shop(A, "barbearia-a")], {
      failTables: [table],
      user: { id: "u1" },
      memberships: [{ user_id: "u1", tenant_id: A, role: "CLIENT" }],
    });
    assert.deepEqual(await getQuickQueueEntry("barbearia-a"), { status: "UNAVAILABLE", viewer: "VISITOR" });
    const reads = globalThis.__qq.reads;
    assert.ok(!reads.some((r) => r.startsWith("branding")), "não lê a marca");
    assert.ok(!reads.includes("auth"), "não olha a sessão");
  });

  await test(`erro na leitura de ${table}: o guard recusa`, async () => {
    setDb([shop(A, "barbearia-a")], { failTables: [table] });
    await assert.rejects(requireQuickQueueOpen("barbearia-a", NOW), (e) => {
      assert.ok(e instanceof QuickQueueClosedError);
      assert.equal(e.message, QUICK_QUEUE_MESSAGES.unavailable);
      return true;
    });
  });
}

// ---------- checagens estáticas ----------

const MOD = path.join(SRC, "features/quick-queue");
const files = readdirSync(MOD, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f));

await test("módulo não importa nada do totem nem do módulo da fila atual", () => {
  for (const f of files) {
    const src = readFileSync(path.join(MOD, f), "utf8");
    assert.ok(!/from\s+["'][^"']*(features\/queue|totem)[^"']*["']/.test(src), f);
  }
});

await test("guard e leitura são server-only; nenhum deles é server action", () => {
  for (const f of ["guard.ts", "data.ts"]) {
    const src = readFileSync(path.join(MOD, f), "utf8");
    assert.match(src, /^import "server-only";/, f);
    assert.ok(!src.includes('"use server"'), f);
  }
});

await test('toda server action do módulo ("use server") passa pelo guard', () => {
  for (const f of files) {
    const src = readFileSync(path.join(MOD, f), "utf8");
    if (!/^["']use server["']/m.test(src)) continue;
    // Aceita anotação de retorno ("): Promise<...> {"). Corpo = até a "}" sozinha na linha.
    const exported = [...src.matchAll(/export\s+async\s+function\s+(\w+)\s*\([^)]*\)[^{]*{([\s\S]*?)\n}/g)];
    assert.ok(exported.length > 0, `${f}: nenhuma ação encontrada para conferir`);
    for (const [, name, body] of exported) assert.match(body, /requireQuickQueueOpen\(/, `${f}: ${name}`);
  }
});

console.log(`\n${passed} testes ok`);

// Testes das regras do totem (validação, limites e mensagens), sem banco e com dados fictícios.
// Roda com: node scripts/test-totem-rules.mjs  (Node 23.6+ remove tipos do .ts sozinho)
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

// Resolve "@/x" e imports relativos sem extensão para arquivos .ts do src.
registerHooks({
  resolve(specifier, context, next) {
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") && context.parentURL.endsWith(".ts")) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target && !path.extname(target)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
      }
    }
    return next(specifier, context);
  },
});

const { isOverLimit, ipTenantKey } = await import("@/lib/rate-limit");
const { isLeadRateLimited, LEAD_RATE_LIMIT } = await import("@/features/leads/rate-limit");
const { TOTEM_ERRORS, TOTEM_LIMITS, TOTEM_RATE_SCOPES, TotemRegisterSchema, totemJoinErrorMessage, totemPhoneDigits } =
  await import("@/features/queue/totem-rules");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("telefone: aceita DDD + número, com ou sem 55, e devolve só dígitos", () => {
  assert.equal(totemPhoneDigits("(21) 99999-0000"), "21999990000");
  assert.equal(totemPhoneDigits("(21) 3333-0000"), "2133330000");
  assert.equal(totemPhoneDigits("+55 21 99999-0000"), "5521999990000");
});

test("telefone: recusa curto, longo, vazio e tipos errados", () => {
  for (const bad of ["", "99999-0000", "55219999900001", "9".repeat(31), null, undefined, 21999990000, {}]) {
    assert.equal(totemPhoneDigits(bad), null, `aceitou ${String(bad)}`);
  }
});

test("cadastro: nome obrigatório e com tamanho máximo; data opcional em ISO", () => {
  const base = { phone: "(21) 99999-0000", name: "  Fulano de Tal  " };
  const ok = TotemRegisterSchema.safeParse(base);
  assert.equal(ok.success, true);
  assert.equal(ok.data.name, "Fulano de Tal");
  assert.equal(TotemRegisterSchema.safeParse({ ...base, birthDate: null }).success, true);
  assert.equal(TotemRegisterSchema.safeParse({ ...base, birthDate: "1990-05-20" }).success, true);
  assert.equal(TotemRegisterSchema.safeParse({ ...base, name: "   " }).success, false);
  assert.equal(TotemRegisterSchema.safeParse({ ...base, name: "a".repeat(81) }).success, false);
  assert.equal(TotemRegisterSchema.safeParse({ ...base, birthDate: "20/05/1990" }).success, false);
  assert.equal(TotemRegisterSchema.safeParse({ ...base, birthDate: "1990-99-99" }).success, false);
  assert.equal(TotemRegisterSchema.safeParse({ ...base, name: 123 }).success, false);
});

test("erro ao gerar senha: código estável vira mensagem fixa; texto do banco nunca passa", () => {
  assert.equal(totemJoinErrorMessage("TOTEM_CLIENT_NOT_IN_TENANT"), TOTEM_ERRORS.clientNotFound);
  assert.equal(totemJoinErrorMessage("TOTEM_SERVICE_NOT_IN_TENANT"), TOTEM_ERRORS.invalidChoice);
  assert.equal(totemJoinErrorMessage("TOTEM_BARBER_NOT_IN_TENANT"), TOTEM_ERRORS.invalidChoice);
  const known = new Set(Object.values(TOTEM_ERRORS));
  for (const raw of [
    'duplicate key value violates unique constraint "uq_queue_ticket"',
    'insert or update on table "queue_entries" violates foreign key constraint',
    "permission denied for function join_queue_totem",
    "",
    null,
    undefined,
  ]) {
    const msg = totemJoinErrorMessage(raw);
    assert.equal(msg, TOTEM_ERRORS.joinFailed);
    assert.ok(known.has(msg));
  }
});

test("limite: libera até o limite e recusa a partir dele", () => {
  for (const [name, rule] of Object.entries(TOTEM_LIMITS)) {
    assert.ok(Number.isInteger(rule.limit) && rule.limit >= 1, `${name}.limit`);
    assert.ok(Number.isInteger(rule.windowSeconds) && rule.windowSeconds >= 1, `${name}.windowSeconds`);
    for (let done = 0; done < rule.limit; done++) assert.equal(isOverLimit(done, rule), false);
    assert.equal(isOverLimit(rule.limit, rule), true, `${name}: passou do limite`);
  }
  assert.equal(TOTEM_LIMITS.invitesPerTenantDay.windowSeconds, 86400);
});

test("limite: chave separa barbearias e escopos não se repetem", () => {
  const ip = "a".repeat(64);
  const t1 = "11111111-1111-4111-8111-111111111111";
  const t2 = "22222222-2222-4222-8222-222222222222";
  assert.notEqual(ipTenantKey(ip, t1), ipTenantKey(ip, t2));
  assert.ok(ipTenantKey(ip, t1).length <= 128, "chave maior que a coluna");
  const scopes = Object.values(TOTEM_RATE_SCOPES);
  assert.equal(new Set(scopes).size, scopes.length);
  for (const s of scopes) assert.ok(s.length <= 40, "escopo maior que a coluna");
});

test("leads: a regra anterior continua igual depois da generalização", () => {
  for (let sent = 0; sent < LEAD_RATE_LIMIT.perIp; sent++) {
    assert.equal(isLeadRateLimited({ ipRecent: sent, globalLastHour: sent }), false);
  }
  assert.equal(isLeadRateLimited({ ipRecent: LEAD_RATE_LIMIT.perIp, globalLastHour: 0 }), true);
  assert.equal(isLeadRateLimited({ ipRecent: 0, globalLastHour: LEAD_RATE_LIMIT.globalPerHour }), true);
});

// ---- Conferências estáticas (texto dos arquivos; o SQL não é executado aqui) ----
const sql = readFileSync(path.join(ROOT, "supabase/schema-50-queue-totem-checks.sql"), "utf8");
const actions = readFileSync(path.join(SRC, "features/queue/totem-actions.ts"), "utf8");
const kiosk = readFileSync(path.join(SRC, "features/queue/components/totem-kiosk.tsx"), "utf8");

test("migration: idempotente, RLS ligada e execute só para service_role", () => {
  assert.match(sql, /create table if not exists public\.rate_limit_events/);
  assert.match(sql, /alter table public\.rate_limit_events enable row level security/);
  assert.match(sql, /revoke all on table public\.rate_limit_events from anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/);
  for (const sig of [
    "rate_limit_hit(text, text, int, int)",
    "join_queue_totem(uuid, uuid, uuid, uuid)",
    "totem_lookup_client(uuid, text)",
  ]) {
    assert.ok(sql.includes(`revoke execute on function public.${sig} from public, anon, authenticated`), sig);
    assert.ok(sql.includes(`grant execute on function public.${sig} to service_role`), sig);
  }
  assert.doesNotMatch(sql, /^\s*(drop|delete|truncate)\b/im, "migration não pode apagar nada");
});

test("migration: join_queue_totem confere as três origens e mantém a assinatura", () => {
  assert.match(sql, /function public\.join_queue_totem\(\s*p_tenant_id uuid, p_client_id uuid, p_service_id uuid, p_barber_id uuid\s*\) returns public\.queue_entries/);
  for (const code of ["TOTEM_CLIENT_NOT_IN_TENANT", "TOTEM_SERVICE_NOT_IN_TENANT", "TOTEM_BARBER_NOT_IN_TENANT"]) {
    assert.ok(sql.includes(`raise exception '${code}'`), code);
  }
  assert.equal((sql.match(/tenant_id = p_tenant_id\s*\) then/g) ?? []).length, 3);
});

test("migration: busca nova não devolve id e totem_find_client não é recriada", () => {
  assert.match(sql, /function public\.totem_lookup_client\(p_tenant uuid, p_digits text\)\s*returns table\(name text, has_plan boolean, plan_name text\)/);
  assert.doesNotMatch(sql, /function public\.totem_find_client/);
});

test("ações e tela: sem id do cliente no contrato e sem texto do banco na resposta", () => {
  assert.doesNotMatch(actions, /clientId/);
  assert.doesNotMatch(kiosk, /clientId|c\.id\b/);
  assert.doesNotMatch(actions, /error:\s*error\??\.message/);
  assert.doesNotMatch(actions, /\?\?\s*"Falha/);
});

console.log(`\n${passed} testes passaram.`);

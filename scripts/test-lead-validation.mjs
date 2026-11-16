// Testes da validação do formulário "Para distribuidoras" (#83), sem banco.
// Roda com: node scripts/test-lead-validation.mjs  (Node 23.6+ remove tipos do .ts sozinho)
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

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

const { DistributorLeadSchema, leadFieldErrors, normalizeBrWhatsapp } = await import("@/features/leads/schema");
const { isLeadRateLimited, LEAD_RATE_LIMIT } = await import("@/features/leads/rate-limit");
const { LEAD_CONSENT_TEXT, LEAD_CONSENT_VERSION } = await import("@/features/leads/consent");

const valid = {
  name: "Fulano de Tal",
  company: "Distribuidora Exemplo",
  city: "Niterói",
  state: "rj",
  whatsapp: "(21) 99999-0000",
  barbershopsCount: "40",
  orderChannel: "whatsapp",
  consent: true,
  website: "",
};

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.message}`);
    process.exitCode = 1;
  }
}
const errorsOf = (input) => {
  const r = DistributorLeadSchema.safeParse(input);
  return r.success ? null : leadFieldErrors(r.error);
};

test("lead válido passa e é normalizado (UF maiúscula, WhatsApp com 55, número)", () => {
  const r = DistributorLeadSchema.parse(valid);
  assert.equal(r.state, "RJ");
  assert.equal(r.whatsapp, "5521999990000");
  assert.equal(r.barbershopsCount, 40);
});

test("campos obrigatórios ausentes → erro por campo", () => {
  const e = errorsOf({ consent: true });
  for (const f of ["name", "company", "city", "state", "whatsapp", "orderChannel"]) assert.ok(e?.[f], `faltou erro em ${f}`);
});

test("campos com 10.000 caracteres → recusados", () => {
  const big = "a".repeat(10_000);
  const e = errorsOf({ ...valid, name: big, company: big, city: big, whatsapp: big });
  for (const f of ["name", "company", "city", "whatsapp"]) assert.ok(e?.[f], `aceitou ${f} gigante`);
});

test('UF "XX" → recusada', () => {
  assert.ok(errorsOf({ ...valid, state: "XX" })?.state);
});

test("WhatsApp inválido → recusado", () => {
  for (const w of ["123", "(00) 99999-0000", "21 89999-0000", "abc", "+1 415 555 0100", "5521999990000123"]) {
    assert.ok(errorsOf({ ...valid, whatsapp: w })?.whatsapp, `aceitou ${w}`);
  }
  assert.equal(normalizeBrWhatsapp("+55 11 98765-4321"), "5511987654321");
  assert.equal(normalizeBrWhatsapp("(11) 3333-4444"), "551133334444");
});

test("quantidade de barbearias fora de 0..100000 → recusada", () => {
  assert.ok(errorsOf({ ...valid, barbershopsCount: -1 })?.barbershopsCount);
  assert.ok(errorsOf({ ...valid, barbershopsCount: 100_001 })?.barbershopsCount);
  assert.ok(errorsOf({ ...valid, barbershopsCount: "1.5" })?.barbershopsCount);
});

test("canal de pedido fora da lista → recusado", () => {
  assert.ok(errorsOf({ ...valid, orderChannel: "telegrama" })?.orderChannel);
});

test("sem aceite (consent ausente, false ou 'true' string) → recusado", () => {
  const { consent: _omit, ...noConsent } = valid;
  assert.ok(errorsOf(noConsent)?.consent);
  assert.ok(errorsOf({ ...valid, consent: false })?.consent);
  assert.ok(errorsOf({ ...valid, consent: "true" })?.consent);
});

test("honeypot preenchido é detectável (a action devolve ok sem gravar)", () => {
  // A action checa `website` ANTES do zod; aqui garantimos que o campo chega e não é descartado.
  const r = DistributorLeadSchema.safeParse({ ...valid, website: "http://spam" });
  assert.ok(r.success && r.data.website === "http://spam");
});

test("rate limit: 6º envio do mesmo IP em 10 min é recusado; limite global por hora", () => {
  assert.equal(LEAD_RATE_LIMIT.perIp, 5);
  assert.equal(LEAD_RATE_LIMIT.perIpWindowMinutes, 10);
  for (let sent = 0; sent < 5; sent++) assert.equal(isLeadRateLimited({ ipRecent: sent, globalLastHour: sent }), false);
  assert.equal(isLeadRateLimited({ ipRecent: 5, globalLastHour: 5 }), true, "6º envio passou");
  assert.equal(isLeadRateLimited({ ipRecent: 0, globalLastHour: LEAD_RATE_LIMIT.globalPerHour }), true);
});

test("texto do aceite diz a finalidade e tem versão", () => {
  assert.match(LEAD_CONSENT_TEXT, /falar comigo sobre o sistema/);
  assert.ok(LEAD_CONSENT_VERSION.length > 0 && LEAD_CONSENT_VERSION.length <= 40);
});

console.log(`\n${passed} teste(s) passaram${process.exitCode ? ", com falhas" : ""}.`);

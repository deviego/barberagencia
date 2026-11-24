// Testes das telas do "Entrar com Google" (ADR 0005, #172): liga/desliga e mensagens de erro do callback.
// Sem banco e sem rede. Roda com: node scripts/test-google-login-ui.mjs  (Node 23.6+ remove tipos do .ts sozinho)
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

registerHooks({
  resolve(specifier, context, next) {
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    if (target && !path.extname(target)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
      }
    }
    return next(specifier, context);
  },
});

const { isGoogleLoginEnabled } = await import("@/lib/auth/google-flag");
const { callbackErrorMessage, GOOGLE_CONFIRM_PATH } = await import("@/features/auth/google-errors");
const privacy = await import("@/lib/legal/content");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// ─── Liga e desliga ─────────────────────────────────────────
test("flag: só 'on' liga o botão", () => {
  const original = process.env.NEXT_PUBLIC_LOGIN_GOOGLE;
  try {
    for (const [value, expected] of [
      [undefined, false],
      ["", false],
      ["off", false],
      ["true", false],
      ["ON", false],
      ["1", false],
      ["on", true],
    ]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_LOGIN_GOOGLE;
      else process.env.NEXT_PUBLIC_LOGIN_GOOGLE = value;
      assert.equal(isGoogleLoginEnabled(), expected, `valor ${JSON.stringify(value)}`);
    }
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_LOGIN_GOOGLE;
    else process.env.NEXT_PUBLIC_LOGIN_GOOGLE = original;
  }
});

// ─── Erros do callback (contrato #170) ──────────────────────
test("erro: cada código do contrato tem texto próprio", () => {
  const codes = ["auth", "google_cancelado", "google_sem_barbearia", "conta_vinculada_outra"];
  const messages = codes.map((c) => callbackErrorMessage(c));
  for (const [i, m] of messages.entries()) assert.ok(m && m.length > 0, `sem texto para ${codes[i]}`);
  assert.equal(new Set(messages).size, codes.length, "dois códigos com o mesmo texto");
});

test("erro: sem código ou código repetido na URL não mostra nada", () => {
  assert.equal(callbackErrorMessage(undefined), null);
  assert.equal(callbackErrorMessage(""), null);
  assert.equal(callbackErrorMessage(["auth", "google_cancelado"]), null);
});

test("erro: código desconhecido cai no genérico e nunca repete o texto da URL", () => {
  const generic = callbackErrorMessage("auth");
  for (const evil of ["<script>alert(1)</script>", "Sua conta foi bloqueada, ligue 0800", "__proto__", "constructor"]) {
    const m = callbackErrorMessage(evil);
    assert.equal(m, generic, `código ${JSON.stringify(evil)}`);
    assert.ok(!m.includes(evil));
  }
});

test("erro: textos sem dado pessoal e sem prometer recuperação que não existe", () => {
  for (const c of ["auth", "google_cancelado", "google_sem_barbearia", "conta_vinculada_outra"]) {
    const m = callbackErrorMessage(c);
    assert.ok(!/@|\d{4,}/.test(m), `texto de ${c} parece ter e-mail ou telefone`);
    assert.ok(!/c[oó]digo|sms/i.test(m), `texto de ${c} cita código/SMS (fase 1 é só senha)`);
  }
});

test("destino: o Google volta para a confirmação do WhatsApp, dentro de /client", () => {
  assert.equal(GOOGLE_CONFIRM_PATH, "/client/confirmar-whatsapp");
  assert.ok(GOOGLE_CONFIRM_PATH.startsWith("/client/") && !GOOGLE_CONFIRM_PATH.startsWith("//"));
});

// ─── Verdade da copy (Regua, #179) ──────────────────────────
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

test("copy: conta só do Google não tem senha (card conectado e privacidade)", () => {
  const card = read("features/auth/components/google-connect-card.tsx");
  const connected = card.slice(card.indexOf("{connected ?"), card.indexOf(") : ("));
  assert.ok(!/senha/i.test(connected), "card conectado cita senha");
  const { PRIVACY } = privacy;
  const google = PRIVACY.sections.flatMap((s) => s.paragraphs).find((p) => p.startsWith("Entrar com Google"));
  assert.ok(google, "parágrafo do Google sumiu da privacidade");
  assert.ok(!/telefone e senha/i.test(google), "privacidade promete telefone e senha");
});

test("copy: ajuda da prova não promete que a barbearia recupera a senha (#175)", () => {
  const flow = read("features/auth/components/confirm-whatsapp-flow.tsx");
  assert.ok(!/recuperar o acesso|recupera(r)? (a|sua) senha/i.test(flow));
  assert.ok(flow.includes("Esqueci minha senha"));
});

console.log(`\n${passed} testes passaram.`);

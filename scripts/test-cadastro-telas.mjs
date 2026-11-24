// Testes das telas do e-mail de contato e da recuperação de senha (#177). Sem banco e sem rede.
// Roda com: node scripts/test-cadastro-telas.mjs  (Node 23.6+ remove tipos do .ts sozinho)
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

const { contactLinkResult, CONTACT_SCREEN_COPY } = await import("@/features/auth/contact-screen-copy");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("?contato=: só os dois resultados do contrato", () => {
  assert.equal(contactLinkResult("confirmado"), "confirmado");
  assert.equal(contactLinkResult("link-invalido"), "link-invalido");
  for (const v of [undefined, "", "enviado", "CONFIRMADO", "__proto__", "<b>x</b>", ["confirmado"], ["confirmado", "link-invalido"]]) {
    assert.equal(contactLinkResult(v), null, `valor ${JSON.stringify(v)}`);
  }
});

test("perfil: não mostra mais o e-mail de login (pode ser técnico)", () => {
  const form = read("features/client/components/perfil-form.tsx");
  assert.ok(!/<Input value=\{email\} disabled/.test(form), "campo de e-mail de login voltou ao perfil");
  const page = read("app/client/(app)/perfil/page.tsx");
  assert.ok(page.includes("email={contact.email"), "perfil deveria usar o e-mail de contato");
});

test("cadastro: aviso só quando informou e-mail", () => {
  const signup = read("features/auth/components/signup-form.tsx");
  assert.ok(signup.includes('form.email.trim() ? "/client?contato=enviado" : "/client"'));
  const home = read("app/client/(app)/page.tsx");
  assert.ok(home.includes('params.contato === "enviado" && <ContactEmailNotice />'));
});

test("recuperar senha: aceita telefone e só reage a ?error=link", () => {
  const form = read("features/auth/components/forgot-form.tsx");
  assert.ok(!/type="email"/.test(form), "campo type=email bloqueia telefone");
  const page = read("app/client/(guest)/recuperar-senha/page.tsx");
  assert.ok(page.includes('.error === "link"'));
});

test("copy: sem promessa de código por SMS/WhatsApp e sem dado pessoal", () => {
  for (const [k, raw] of Object.entries(CONTACT_SCREEN_COPY)) {
    const t = typeof raw === "function" ? raw("Barbearia Teste") : raw;
    assert.ok(!/sms|whatsapp|c[oó]digo/i.test(t), `${k} promete canal que não existe`);
    assert.ok(!/@\w|\d{4,}/.test(t), `${k} parece ter dado pessoal`);
  }
});

test("convite: cadastro com convite pendente conclui dentro de /client", () => {
  const form = read("features/auth/components/accept-invite-form.tsx");
  assert.ok(!form.includes("completeInviteAcceptance"), "a ação não enxerga a sessão em /convite");
  assert.ok(form.includes("/client/concluir-convite/"));
  const flow = read("features/auth/components/complete-invite.tsx");
  for (const code of ["NOT_SIGNED_IN", "INVALID_INVITE"]) assert.ok(flow.includes(code), `sem tratamento de ${code}`);
  assert.ok(flow.includes('router.replace("/client")'), "ok deveria seguir para o app");
});

test("perfil: link velho com e-mail confirmado não pede Reenviar", () => {
  const card = read("features/auth/components/contact-email-card.tsx");
  assert.ok(card.includes("linkResult && state.verified"));
});

console.log(`\n${passed} testes passaram.`);

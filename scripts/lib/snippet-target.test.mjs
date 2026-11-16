// Escolha do destino a partir do snippet do Vercel (sem banco). Rodar: node --test scripts/lib/
// Todos os valores são FICTÍCIOS; só a ref de staging é a real (não é segredo).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GuardError, PROD_PROJECT_REF as PROD } from "./schema-apply.mjs";
import { parseSnippet, targetsFromSnippet, STAGING_PROJECT_REF as REF } from "./snippet-target.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "snippet-target-"));
const CA = path.join(tmp, "ca.crt");
fs.writeFileSync(CA, "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----\n");
const SECRET = "S3nhaFicticia-NAO-VAZAR";
const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.assinatura`;
const SERVICE = jwt({ ref: REF, role: "service_role" });
const pooler = (port, ref = REF) => `postgres://postgres.${ref}:${SECRET}@aws-1-sa-east-1.pooler.supabase.com:${port}/postgres`;

/** Snippet no formato do "Copy Snippet" do Vercel, com o prefixo STAGING_. */
const snippet = (over = {}) => {
  const v = {
    STAGING_POSTGRES_URL: `${pooler(6543)}?sslmode=require&supa=base-pooler.x`,
    STAGING_POSTGRES_PRISMA_URL: `${pooler(6543)}?sslmode=require&pgbouncer=true`,
    STAGING_POSTGRES_URL_NON_POOLING: `${pooler(5432)}?sslmode=require`,
    STAGING_POSTGRES_HOST: `db.${REF}.supabase.co`,
    STAGING_POSTGRES_USER: "postgres",
    STAGING_POSTGRES_PASSWORD: SECRET,
    STAGING_POSTGRES_DATABASE: "postgres",
    STAGING_SUPABASE_URL: `https://${REF}.supabase.co`,
    STAGING_NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
    STAGING_SUPABASE_ANON_KEY: jwt({ ref: REF, role: "anon" }),
    STAGING_SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    STAGING_SUPABASE_JWT_SECRET: "jwt-secret-ficticio",
    ...over,
  };
  return Object.entries(v).filter(([, x]) => x != null).map(([k, x]) => `${k}="${x}"`).join("\n");
};
const pick = (over, o = {}) => targetsFromSnippet(snippet(over), { caPath: CA, ...o });
const refused = (fn, re) =>
  assert.throws(fn, (e) => {
    assert.ok(e instanceof GuardError, `esperava GuardError, veio ${e}`);
    assert.ok(!e.message.includes(SECRET), "a mensagem de erro vazou a senha");
    assert.ok(!e.message.includes(SERVICE), "a mensagem de erro vazou a service_role");
    if (re) assert.match(e.message, re);
    return true;
  });

test("parseSnippet: aspas, export, comentários e linhas vazias", () => {
  const v = parseSnippet(`# comentário\n\nexport A="1"\nB='2'\nC=3\nD=""\nlixo sem igual\n`);
  assert.deepEqual([...v], [["A", "1"], ["B", "2"], ["C", "3"]]);
  refused(() => parseSnippet(""), /Copy Snippet/);
  refused(() => parseSnippet("texto qualquer copiado por engano"), /Copy Snippet/);
});

test("escolhe o pooler de SESSÃO (5432), nunca a direta nem o 6543", () => {
  const t = pick();
  assert.equal(t.db.host, "aws-1-sa-east-1.pooler.supabase.com");
  assert.equal(t.db.port, 5432);
  assert.equal(t.db.user, `postgres.${REF}`);
  assert.equal(t.db.password, SECRET);
  assert.equal(t.db.ssl.rejectUnauthorized, true);
  assert.equal(t.dbFrom, "STAGING_POSTGRES_URL_NON_POOLING");
  assert.equal(t.dbDerived, false);
  assert.equal(t.apiUrl, `https://${REF}.supabase.co`);
  assert.equal(t.serviceKey, SERVICE);
});

test("conexão direta (IPv6) no NON_POOLING é ignorada; deriva a sessão do pooler 6543", () => {
  const t = pick({ STAGING_POSTGRES_URL_NON_POOLING: `postgres://postgres:${SECRET}@db.${REF}.supabase.co:5432/postgres` });
  assert.equal(t.db.host, "aws-1-sa-east-1.pooler.supabase.com");
  assert.equal(t.db.port, 5432);
  assert.equal(t.dbDerived, true);
});

test("funciona sem prefixo e com outro prefixo", () => {
  const plain = snippet().replaceAll("STAGING_", "");
  assert.equal(targetsFromSnippet(plain, { caPath: CA }).db.port, 5432);
  assert.equal(targetsFromSnippet(snippet().replaceAll("STAGING_", "HML_"), { caPath: CA }).db.port, 5432);
});

test("recusa snippet sem pooler, sem SUPABASE_URL ou sem service_role", () => {
  const direct = `postgres://postgres:${SECRET}@db.${REF}.supabase.co:5432/postgres`;
  refused(
    () => pick({ STAGING_POSTGRES_URL: direct, STAGING_POSTGRES_PRISMA_URL: direct, STAGING_POSTGRES_URL_NON_POOLING: direct }),
    /pooler/
  );
  refused(() => pick({ STAGING_SUPABASE_URL: null, STAGING_NEXT_PUBLIC_SUPABASE_URL: null }), /SUPABASE_URL/);
  refused(() => pick({ STAGING_SUPABASE_SERVICE_ROLE_KEY: null }), /SERVICE_ROLE_KEY/);
});

test("recusa PRODUÇÃO em qualquer campo", () => {
  const prodDb = { STAGING_POSTGRES_URL: pooler(6543, PROD), STAGING_POSTGRES_PRISMA_URL: pooler(6543, PROD), STAGING_POSTGRES_URL_NON_POOLING: pooler(5432, PROD) };
  refused(() => pick(prodDb), /PRODUÇÃO/);
  refused(() => pick({ STAGING_SUPABASE_URL: `https://${PROD}.supabase.co` }), /PRODUÇÃO/);
  refused(() => pick({ STAGING_SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: PROD, role: "service_role" }) }), /PRODUÇÃO/);
});

test("recusa outro projeto, URLs divergentes, chave anon e certificado ausente", () => {
  const other = "zzzzzzzzzzzzzzzzzzzz";
  refused(() => pick({ STAGING_POSTGRES_URL: pooler(6543, other), STAGING_POSTGRES_PRISMA_URL: null, STAGING_POSTGRES_URL_NON_POOLING: pooler(5432, other) }), /allowlist/);
  refused(() => pick({ STAGING_SUPABASE_URL: `https://${other}.supabase.co`, STAGING_NEXT_PUBLIC_SUPABASE_URL: null }), /staging/);
  refused(() => pick({ STAGING_SUPABASE_URL: `https://${REF}.supabase.co.evil.com` }), /staging/);
  refused(() => pick({ STAGING_SUPABASE_URL: `http://${REF}.supabase.co` }), /staging/);
  refused(() => pick({ STAGING_SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: REF, role: "anon" }) }), /service_role/);
  refused(() => pick({ STAGING_SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: other, role: "service_role" }) }), /staging/);
  refused(() => pick({}, { caPath: path.join(tmp, "nao-existe.crt") }), /SUPABASE_CA_CERT/);
});

test("--local: só loopback, no banco e na API", () => {
  const localSnippet = (over = {}) =>
    snippet({
      STAGING_POSTGRES_URL: null,
      STAGING_POSTGRES_PRISMA_URL: null,
      STAGING_POSTGRES_URL_NON_POOLING: "postgres://postgres:postgres@127.0.0.1:54322/postgres",
      STAGING_SUPABASE_URL: "http://127.0.0.1:54321",
      STAGING_NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: jwt({ iss: "supabase-demo", role: "service_role" }),
      ...over,
    });
  const t = targetsFromSnippet(localSnippet(), { local: true });
  assert.equal(t.db.host, "127.0.0.1");
  assert.equal(t.db.ssl, false);
  assert.equal(t.apiUrl, "http://127.0.0.1:54321");
  refused(() => targetsFromSnippet(snippet(), { local: true }), /--local/);
  refused(() => targetsFromSnippet(localSnippet({ STAGING_SUPABASE_URL: `https://${REF}.supabase.co` }), { local: true }), /--local/);
  // e o inverso: snippet local sem --local não passa
  refused(() => targetsFromSnippet(localSnippet(), { caPath: CA }), /pooler/);
});

// Regressão das guardas de destino (sem banco). Rodar: node --test scripts/lib/
// Cada bypass que a Navalha demonstrou contra a versão 7ceab29 tem um caso aqui.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stagingTarget, localTarget, loadManifest, GuardError, PROD_PROJECT_REF } from "./schema-apply.mjs";

const REF = "abcdefghijklmnopqrst"; // ref FICTÍCIA de staging
const PROD = PROD_PROJECT_REF;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "schema-apply-"));
const CA = path.join(tmp, "ca.crt");
fs.writeFileSync(CA, "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----\n");
const ok = (url, extra = {}) => stagingTarget({ url, projectRef: REF, caPath: CA, ...extra });
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof GuardError && (!re || re.test(e.message)));

test("staging: aceita pooler e conexão direta do projeto de staging, com SSL verificado", () => {
  const p = ok(`postgresql://postgres.${REF}:s3nh%40@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`);
  assert.equal(p.host, "aws-1-sa-east-1.pooler.supabase.com");
  assert.equal(p.password, "s3nh@");
  assert.equal(p.ssl.rejectUnauthorized, true);
  assert.match(p.ssl.ca, /BEGIN CERTIFICATE/);
  const d = ok(`postgresql://postgres:x@db.${REF}.supabase.co:5432/postgres?sslmode=verify-full`);
  assert.equal(d.host, `db.${REF}.supabase.co`);
});

const bypasses = {
  "ref de prod em MAIÚSCULAS no usuário": `postgresql://postgres.${PROD.toUpperCase()}:x@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`,
  "pooler aws-1-* com usuário de prod": `postgresql://postgres.${PROD}:x@aws-1-ca-central-1.pooler.supabase.com:5432/postgres`,
  "percent-encoding no host": `postgresql://postgres:x@%64b.${PROD}.supabase.co:5432/postgres`,
  "percent-encoding no usuário": `postgresql://postgres.%74usfxbnnrypjtzqcvpov:x@aws-0-ca-central-1.pooler.supabase.com/postgres`,
  "IP literal": "postgresql://postgres:x@3.97.12.34:5432/postgres",
  "IPv6 literal": "postgresql://postgres:x@[2600:1f18::1]:5432/postgres",
  "?host= apontando para prod": `postgresql://postgres:x@db.${REF}.supabase.co:5432/postgres?host=db.${PROD}.supabase.co`,
  "?HOST= em maiúsculas": `postgresql://postgres:x@db.${REF}.supabase.co/postgres?HOST=db.${PROD}.supabase.co`,
  "?hostaddr=": `postgresql://postgres:x@db.${REF}.supabase.co/postgres?hostaddr=3.97.12.34`,
  "socket unix": "postgresql://postgres:x@%2Fvar%2Frun%2Fpostgresql/postgres",
  "outro projeto Supabase qualquer": "postgresql://postgres:x@db.zzzzzzzzzzzzzzzzzzzz.supabase.co/postgres",
  "host parecido (sufixo)": `postgresql://postgres:x@db.${REF}.supabase.co.evil.com/postgres`,
  "pooler com usuário de outro projeto": "postgresql://postgres.zzzzzzzzzzzzzzzzzzzz:x@aws-0-sa-east-1.pooler.supabase.com/postgres",
  "sslmode=disable": `postgresql://postgres:x@db.${REF}.supabase.co/postgres?sslmode=disable`,
  "sslmode=no-verify": `postgresql://postgres:x@db.${REF}.supabase.co/postgres?sslmode=no-verify`,
  "sslmode=prefer": `postgresql://postgres:x@db.${REF}.supabase.co/postgres?sslmode=prefer`,
  "ssl=false": `postgresql://postgres:x@db.${REF}.supabase.co/postgres?ssl=false`,
};
for (const [name, url] of Object.entries(bypasses)) {
  test(`staging recusa: ${name}`, () => refused(() => ok(url)));
}

test("staging recusa sem STAGING_PROJECT_REF, ref inválida ou ref de prod", () => {
  const url = `postgresql://postgres:x@db.${REF}.supabase.co/postgres`;
  refused(() => ok(url, { projectRef: undefined }), /STAGING_PROJECT_REF/);
  refused(() => ok(url, { projectRef: "curta" }), /STAGING_PROJECT_REF/);
  refused(() => ok(url, { projectRef: PROD.toUpperCase() }), /PRODUÇÃO/);
});

test("staging recusa sem CA, CA ilegível ou que não é PEM", () => {
  const url = `postgresql://postgres:x@db.${REF}.supabase.co/postgres`;
  refused(() => ok(url, { caPath: undefined }), /SUPABASE_CA_CERT/);
  refused(() => ok(url, { caPath: path.join(tmp, "nao-existe.crt") }), /SUPABASE_CA_CERT/);
  const bad = path.join(tmp, "bad.crt");
  fs.writeFileSync(bad, "não é certificado");
  refused(() => ok(url, { caPath: bad }), /PEM/);
});

test("local: aceita só loopback, sem SSL", () => {
  for (const h of ["127.0.0.1", "localhost", "LOCALHOST", "[::1]"]) {
    assert.equal(localTarget(`postgresql://postgres:postgres@${h}:54322/postgres`).ssl, false);
  }
  refused(() => localTarget("postgresql://postgres:x@db.x.supabase.co/postgres"), /loopback/);
  refused(() => localTarget("postgresql://postgres:x@10.0.0.5/postgres"), /loopback/);
  refused(() => localTarget(`postgresql://postgres:x@127.0.0.1/postgres?host=db.${PROD}.supabase.co`), /host/);
  refused(() => localTarget("postgresql://postgres:x@127.0.0.1/postgres?hostaddr=3.97.12.34"), /hostaddr/);
  refused(() => localTarget(`postgresql://postgres.${PROD}:x@127.0.0.1/postgres`), /PRODUÇÃO/);
});

test("manifesto do repositório é válido e recusa arquivo fora da lista, inexistente, repetido ou seed", () => {
  assert.ok(loadManifest().files.length >= 37);
  const dir = fs.mkdtempSync(path.join(tmp, "sb-"));
  const w = (f, s = "select 1;") => fs.writeFileSync(path.join(dir, f), s);
  w("schema.sql");
  w("schema-2.sql");
  w("ci-order.txt", "schema.sql\nschema-2.sql\n");
  assert.deepEqual(loadManifest(dir).files, ["schema.sql", "schema-2.sql"]);
  w("schema-3.sql");
  refused(() => loadManifest(dir), /Fora do ci-order/);
  w("ci-order.txt", "schema.sql\nschema-2.sql\nschema-3.sql\nschema-4.sql\n");
  refused(() => loadManifest(dir), /não existe/);
  w("ci-order.txt", "schema.sql\nschema-2.sql\nschema-3.sql\nschema-3.sql\n");
  refused(() => loadManifest(dir), /Repetidos/);
  w("seed.sql");
  w("ci-order.txt", "schema.sql\nschema-2.sql\nschema-3.sql\nseed.sql\n");
  refused(() => loadManifest(dir), /seeds nunca/);
});

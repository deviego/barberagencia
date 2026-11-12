// Testes da resolução de ambiente do Supabase, sem rede e sem banco. Valores fictícios.
// Roda com: node scripts/test-supabase-env.mjs  (Node 23.6+ remove tipos do .ts sozinho)
import { registerHooks } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

// Resolve "@/x" e imports relativos sem extensão; "server-only" vira módulo vazio fora do Next.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
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

const { resolveSupabasePublicEnv, supabaseTarget, SupabaseEnvError, PRODUCTION_SUPABASE_HOST } = await import("@/lib/supabase/env");
const { resolveSupabaseAdminEnv } = await import("@/lib/supabase/env.server");
const { resolveWaGatewayEnv } = await import("@/server/wa-env");
const check = await import("./check-preview-env.mjs");

const PROD = {
  NEXT_PUBLIC_SUPABASE_URL: "https://padrao.example.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-padrao",
  SUPABASE_SERVICE_ROLE_KEY: "service-padrao",
};
const STG = {
  NEXT_PUBLIC_STAGING_SUPABASE_URL: "https://homolog.example.test",
  NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY: "anon-homolog",
  STAGING_SUPABASE_SERVICE_ROLE_KEY: "service-homolog",
};
const WA = { WA_SERVICE_URL: "https://wa-padrao.example.test", WA_SERVICE_TOKEN: "token-padrao" };
const STG_WA = { STAGING_WA_SERVICE_URL: "https://wa-homolog.example.test", STAGING_WA_SERVICE_TOKEN: "token-homolog" };
const onVercel = (v) => ({ VERCEL_ENV: v, NEXT_PUBLIC_VERCEL_ENV: v });

/** Env de preview em que qualquer leitura dos nomes padrão (Supabase ou WhatsApp) estoura. */
function defaultForbidden(env) {
  return new Proxy(env, {
    get(t, k) {
      if (typeof k === "string" && /SUPABASE|WA_SERVICE/.test(k) && !k.includes("STAGING")) throw new Error(`leu ${k}`);
      return t[k];
    },
  });
}

/** Env em que qualquer leitura de STAGING_* estoura: prova que a variável nem é lida. */
function stagingForbidden(env) {
  return new Proxy(env, {
    get(t, k) {
      if (typeof k === "string" && k.includes("STAGING")) throw new Error(`leu ${k}`);
      return t[k];
    },
  });
}

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}
const refuses = (fn, re) => assert.throws(fn, (e) => e instanceof SupabaseEnvError && re.test(e.message));

test("produção usa os nomes de sempre", () => {
  const env = { ...onVercel("production"), ...PROD };
  assert.deepEqual(resolveSupabasePublicEnv(env), { target: "default", url: PROD.NEXT_PUBLIC_SUPABASE_URL, anonKey: "anon-padrao" });
  assert.deepEqual(resolveSupabaseAdminEnv(env), { target: "default", url: PROD.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: "service-padrao" });
});

test("produção com STAGING_* presente: ignora e nem lê", () => {
  const env = stagingForbidden({ ...onVercel("production"), ...PROD, ...STG });
  assert.equal(resolveSupabasePublicEnv(env).url, PROD.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(resolveSupabasePublicEnv(env).anonKey, "anon-padrao");
  assert.equal(resolveSupabaseAdminEnv(env).serviceRoleKey, "service-padrao");
  // sem a variável pública de sistema (navegador decide igual: nomes de sempre)
  const semPublica = stagingForbidden({ VERCEL_ENV: "production", ...PROD, ...STG });
  assert.equal(resolveSupabasePublicEnv(semPublica).target, "default");
});

test("produção sem as variáveis de sempre: erro, sem recorrer às de homologação", () => {
  const env = stagingForbidden({ ...onVercel("production"), ...STG });
  refuses(() => resolveSupabasePublicEnv(env), /NEXT_PUBLIC_SUPABASE_URL ausente/);
  refuses(() => resolveSupabaseAdminEnv({ ...onVercel("production"), ...PROD, ...STG, SUPABASE_SERVICE_ROLE_KEY: "" }), /SUPABASE_SERVICE_ROLE_KEY ausente/);
});

test("preview completo usa homologação (com ou sem as de produção presentes)", () => {
  for (const env of [{ ...onVercel("preview"), ...STG }, defaultForbidden({ ...onVercel("preview"), ...PROD, ...STG })]) {
    assert.deepEqual(resolveSupabasePublicEnv(env), { target: "staging", url: STG.NEXT_PUBLIC_STAGING_SUPABASE_URL, anonKey: "anon-homolog" });
    assert.deepEqual(resolveSupabaseAdminEnv(env), { target: "staging", url: STG.NEXT_PUBLIC_STAGING_SUPABASE_URL, serviceRoleKey: "service-homolog" });
  }
});

test("preview sem STAGING_*: recusa, nunca devolve as de produção", () => {
  const env = { ...onVercel("preview"), ...PROD };
  // nem lê os nomes padrão
  assert.throws(() => resolveSupabaseAdminEnv(defaultForbidden(env)), SupabaseEnvError);
  refuses(() => resolveSupabasePublicEnv(env), /NEXT_PUBLIC_STAGING_SUPABASE_URL, NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY/);
  refuses(() => resolveSupabaseAdminEnv(env), /Preview sem ambiente/);
  // faltando uma só
  refuses(() => resolveSupabasePublicEnv({ ...env, NEXT_PUBLIC_STAGING_SUPABASE_URL: "https://homolog.example.test" }), /Faltando: NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY\./);
  refuses(() => resolveSupabaseAdminEnv({ ...env, ...STG, STAGING_SUPABASE_SERVICE_ROLE_KEY: undefined }), /STAGING_SUPABASE_SERVICE_ROLE_KEY/);
  // string vazia conta como ausente
  refuses(() => resolveSupabaseAdminEnv({ ...env, ...STG, STAGING_SUPABASE_SERVICE_ROLE_KEY: "" }), /STAGING_SUPABASE_SERVICE_ROLE_KEY/);
});

test("preview com a URL do projeto de produção (ou URL ilegível): recusa", () => {
  for (const url of [`https://${PRODUCTION_SUPABASE_HOST}`, `https://${PRODUCTION_SUPABASE_HOST.toUpperCase()}/rest/v1`, `https://${PRODUCTION_SUPABASE_HOST}.`, `https://${PRODUCTION_SUPABASE_HOST}.:443/x`, "nao-e-url"]) {
    const env = { ...onVercel("preview"), ...STG, NEXT_PUBLIC_STAGING_SUPABASE_URL: url };
    refuses(() => resolveSupabasePublicEnv(env), /projeto próprio/);
    refuses(() => resolveSupabaseAdminEnv(env), /projeto próprio/);
    assert.ok(check.previewEnvProblems(env).length > 0);
  }
});

test("local (sem VERCEL_ENV) fica igual a hoje", () => {
  const env = stagingForbidden({ ...PROD, ...STG });
  assert.equal(resolveSupabasePublicEnv(env).url, PROD.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(resolveSupabaseAdminEnv(env).serviceRoleKey, "service-padrao");
  assert.equal(resolveSupabasePublicEnv(stagingForbidden({ ...onVercel("development"), ...PROD })).target, "default");
});

test("navegador decide pela variável pública de sistema", () => {
  assert.equal(supabaseTarget({ NEXT_PUBLIC_VERCEL_ENV: "preview" }), "staging");
  assert.equal(supabaseTarget({ NEXT_PUBLIC_VERCEL_ENV: "production" }), "default");
  assert.equal(supabaseTarget({}), "default");
});

test("servidor e navegador discordando sobre preview: recusa", () => {
  refuses(() => resolveSupabasePublicEnv({ VERCEL_ENV: "preview", ...PROD, ...STG }), /discordam/);
  refuses(() => resolveSupabasePublicEnv({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "preview", ...PROD, ...STG }), /discordam/);
  refuses(() => resolveSupabaseAdminEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "production", ...PROD, ...STG }), /discordam/);
});

test("mensagens de erro citam só nomes de variável, nunca valores", () => {
  const cases = [
    { ...onVercel("preview"), ...PROD },
    { ...onVercel("preview"), ...PROD, ...STG, NEXT_PUBLIC_STAGING_SUPABASE_URL: "nao-e-url-segredo" },
    { VERCEL_ENV: "preview", ...PROD, ...STG },
    { ...onVercel("preview"), ...PROD, ...STG, STAGING_SUPABASE_SERVICE_ROLE_KEY: "" },
  ];
  for (const env of cases) {
    try {
      resolveSupabaseAdminEnv(env);
      assert.fail("deveria recusar");
    } catch (e) {
      assert.ok(e instanceof SupabaseEnvError);
      for (const v of [...Object.values(PROD), ...Object.values(STG), "nao-e-url-segredo"]) assert.ok(!e.message.includes(v), e.message);
    }
    const txt = check.previewEnvProblems({ ...env, STAGING_WA_SERVICE_URL: STG_WA.STAGING_WA_SERVICE_URL }).join("\n");
    for (const v of [...Object.values(PROD), ...Object.values(STG), ...Object.values(STG_WA), "nao-e-url-segredo"]) assert.ok(!txt.includes(v), txt);
  }
});

test("WhatsApp: produção e local usam os nomes de sempre e não leem STAGING_*", () => {
  for (const v of ["production", "development", undefined]) {
    const env = stagingForbidden({ VERCEL_ENV: v, ...WA, ...STG_WA });
    assert.deepEqual(resolveWaGatewayEnv(env), { url: WA.WA_SERVICE_URL, token: "token-padrao" });
  }
  assert.equal(resolveWaGatewayEnv(stagingForbidden({ VERCEL_ENV: "production", ...STG_WA })), null);
  assert.equal(resolveWaGatewayEnv({ VERCEL_ENV: "production", WA_SERVICE_URL: WA.WA_SERVICE_URL }), null);
});

test("WhatsApp: preview nunca lê os nomes de produção; sem STAGING_WA_* fica desligado", () => {
  const p = (extra) => defaultForbidden({ VERCEL_ENV: "preview", ...WA, ...extra });
  assert.equal(resolveWaGatewayEnv(p({})), null);
  assert.equal(resolveWaGatewayEnv(p({ STAGING_WA_SERVICE_URL: STG_WA.STAGING_WA_SERVICE_URL })), null);
  assert.equal(resolveWaGatewayEnv(p({ STAGING_WA_SERVICE_TOKEN: "token-homolog" })), null);
  assert.deepEqual(resolveWaGatewayEnv(p(STG_WA)), { url: STG_WA.STAGING_WA_SERVICE_URL, token: "token-homolog" });
});

test("build: fora do preview não confere nada; preview completo passa", () => {
  assert.deepEqual(check.previewEnvProblems({ VERCEL_ENV: "production" }), []);
  assert.deepEqual(check.previewEnvProblems({}), []);
  assert.deepEqual(check.previewEnvProblems({ VERCEL_ENV: "preview", ...STG }), []);
  assert.deepEqual(check.previewEnvProblems({ VERCEL_ENV: "preview", ...STG, ...STG_WA }), []);
  assert.doesNotThrow(() => check.assertPreviewEnv(defaultForbidden({ VERCEL_ENV: "preview", ...PROD, ...WA, ...STG })));
});

test("build: preview faltando qualquer variável quebra, e concorda com o runtime", () => {
  for (const name of Object.keys(STG)) {
    const env = { ...onVercel("preview"), ...PROD, ...STG, [name]: "" };
    assert.throws(() => check.assertPreviewEnv(env), new RegExp(`${name} ausente`));
    assert.throws(() => resolveSupabaseAdminEnv(env), SupabaseEnvError);
  }
  assert.equal(check.previewEnvProblems({ VERCEL_ENV: "preview", ...PROD }).length, 3);
  assert.throws(() => check.assertPreviewEnv({ VERCEL_ENV: "preview", ...STG, STAGING_WA_SERVICE_URL: STG_WA.STAGING_WA_SERVICE_URL }), /as duas ou nenhuma/);
  assert.equal(check.PRODUCTION_SUPABASE_HOST, PRODUCTION_SUPABASE_HOST);
});

test("build no Vercel sem VERCEL_ENV: recusa; fora do Vercel segue como local", () => {
  for (const v of [undefined, ""]) {
    assert.throws(() => check.assertPreviewEnv({ VERCEL: "1", VERCEL_ENV: v, ...PROD, ...STG }), /VERCEL_ENV ausente/);
  }
  assert.doesNotThrow(() => check.assertPreviewEnv({ VERCEL: "1", VERCEL_ENV: "production", ...PROD }));
  assert.doesNotThrow(() => check.assertPreviewEnv({ VERCEL: "1", VERCEL_ENV: "preview", ...STG }));
  assert.doesNotThrow(() => check.assertPreviewEnv({ ...PROD }));
});

test("estático: mensagens de 'não configurado' não citam nome de variável do gateway", () => {
  const read = (p) => readFileSync(path.join(SRC, p), "utf8");
  for (const f of ["features/admin/whatsapp-actions.ts", "features/platform/actions.ts", "app/api/master/report/pdf/route.ts", "features/admin/actions.ts", "features/orders/actions.ts"]) {
    assert.ok(!read(f).includes("WA_SERVICE"), f);
  }
});

test("estático: variáveis só nos resolvedores; service role fora do módulo público", () => {
  const read = (p) => readFileSync(path.join(SRC, p), "utf8");
  for (const f of ["lib/supabase/admin.ts", "lib/supabase/client.ts", "lib/supabase/server.ts", "middleware.ts"]) {
    assert.ok(!/process\.env\.[A-Z_]*SUPABASE/.test(read(f)), f);
  }
  // Nenhum outro arquivo do src lê as variáveis do Supabase ou do gateway direto do process.env.
  const allowed = new Set(["lib/supabase/env.ts", "lib/supabase/env.server.ts", "server/wa-env.ts"]);
  const offenders = readdirSync(SRC, { recursive: true })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !allowed.has(f.split(path.sep).join("/")))
    .filter((f) => /process\.env\.[A-Z_]*(SUPABASE|WA_SERVICE)|process\.env\[/.test(read(f)));
  assert.deepEqual(offenders, []);
  const config = readFileSync(path.join(SRC, "../next.config.mjs"), "utf8");
  assert.ok(config.includes("assertPreviewEnv(process.env)"));
  assert.ok(config.includes("NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV"));
  const pub = read("lib/supabase/env.ts");
  assert.ok(!pub.includes("SERVICE_ROLE"));
  assert.ok(!/process\.env\[/.test(pub), "sem acesso dinâmico");
  assert.ok(!/from "(node:|fs|path|crypto|server-only)/.test(pub), "sem dependência de Node");
  for (const name of ["NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_STAGING_SUPABASE_URL", "NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY"]) {
    assert.ok(pub.includes(`process.env.${name}`), name);
  }
  assert.ok(read("lib/supabase/env.server.ts").startsWith('import "server-only";'));
});

console.log(`\n${n} testes passaram.`);

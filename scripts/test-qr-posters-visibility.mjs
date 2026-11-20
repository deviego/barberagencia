// Teste da regra do cartaz A (#127), sem rede e sem banco.
// Roda com: node scripts/test-qr-posters-visibility.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/features/admin/components/qr-posters/visibility.ts");
const js = ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { showQueuePoster, showQueuePosterHint, quickQueueOnFor, quickQueueLimitAlert } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

// Passos do cartaz A (#127/#145): módulo puro, sem canvas.
const copyFile = path.resolve(path.dirname(file), "copy.ts");
const copyJs = ts.transpileModule(readFileSync(copyFile, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { queuePosterSteps } = await import(`data:text/javascript;base64,${Buffer.from(copyJs).toString("base64")}`);

let n = 0;
function check(name, input, expected) {
  assert.equal(showQueuePoster(input), expected, name);
  n++;
}

// Só true/true/true mostra.
check("tudo ligado", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: true }, true);
check("tudo ligado, modo APP", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: true, queueMode: "APP" }, true);
check("tudo ligado, modo BOTH", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: true, queueMode: "BOTH" }, true);

// Qualquer combinação com false esconde.
for (const p of [true, false]) for (const q of [true, false]) for (const r of [true, false]) {
  if (p && q && r) continue;
  check(`plano=${p} fila=${q} rapida=${r}`, { planHasQueue: p, queueEnabled: q, quickQueueEnabled: r }, false);
}

// Coluna ausente / erro de leitura chegam como null ou undefined: esconde.
check("coluna ausente (undefined)", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: undefined }, false);
check("erro de leitura (null)", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: null }, false);
check("plano desconhecido (null)", { planHasQueue: null, queueEnabled: true, quickQueueEnabled: true }, false);
check("fila desconhecida (undefined)", { planHasQueue: true, queueEnabled: undefined, quickQueueEnabled: true }, false);
// Valores "verdadeiros" que não são true não abrem.
check("string 'true'", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: "true" }, false);
check("número 1", { planHasQueue: 1, queueEnabled: true, quickQueueEnabled: true }, false);

// Modo só totem esconde mesmo com tudo ligado.
check("modo TOTEM", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: true, queueMode: "TOTEM" }, false);

// Aviso do cartaz da fila (#102): só com plano + fila ligada e a fila rápida desligada.
function hint(name, input, expected) {
  assert.equal(showQueuePosterHint(input), expected, `aviso: ${name}`);
  n++;
}
hint("rápida desligada", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: false }, true);
hint("rápida desconhecida (null)", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: null }, true);
hint("rápida ligada", { planHasQueue: true, queueEnabled: true, quickQueueEnabled: true }, false);
hint("plano sem fila", { planHasQueue: false, queueEnabled: true, quickQueueEnabled: false }, false);
hint("fila desligada", { planHasQueue: true, queueEnabled: false, quickQueueEnabled: false }, false);
hint("plano desconhecido", { planHasQueue: undefined, queueEnabled: true, quickQueueEnabled: false }, false);

// Leitura da chave (falha fechado): só o estado DESTA barbearia com true liga.
function qq(name, state, expected) {
  assert.equal(quickQueueOnFor(state, "t1"), expected, `chave: ${name}`);
  n++;
}
qq("ligada", { id: "t1", quickQueueEnabled: true }, true);
qq("desligada", { id: "t1", quickQueueEnabled: false }, false);
qq("coluna ausente", { id: "t1" }, false);
qq("valor null", { id: "t1", quickQueueEnabled: null }, false);
qq("outra barbearia", { id: "t2", quickQueueEnabled: true }, false);
qq("sem estado (null)", null, false);
qq("sem estado (undefined)", undefined, false);
qq("string 'true'", { id: "t1", quickQueueEnabled: "true" }, false);
assert.equal(quickQueueOnFor({ id: "", quickQueueEnabled: true }, ""), false, "chave: tenant vazio");
n++;

// Alerta ao dono (#145): teto ou total >= 20, só com a fila rápida ligada.
function alert(name, summary, on, expected) {
  assert.equal(quickQueueLimitAlert(summary, on, 20), expected, `alerta: ${name}`);
  n++;
}
alert("teto atingido", { total: 3, tenantCapHit: true }, true, "CAP");
alert("teto e total alto: texto do teto", { total: 50, tenantCapHit: true }, true, "CAP");
alert("total 20", { total: 20, tenantCapHit: false }, true, "HIGH");
alert("total 19", { total: 19, tenantCapHit: false }, true, null);
alert("zero", { total: 0, tenantCapHit: false }, true, null);
alert("fila rápida desligada", { total: 99, tenantCapHit: true }, false, null);
alert("fila rápida desconhecida", { total: 99, tenantCapHit: true }, undefined, null);
alert("sem resumo (erro)", null, true, null);
alert("total inválido", { total: Number.NaN, tenantCapHit: false }, true, null);
alert("total ausente", { tenantCapHit: false }, true, null);

// Passo 2 do cartaz A: telefone com a fila rápida ligada; conta com login.
assert.equal(queuePosterSteps("PHONE")[1], "Digite o seu telefone", "passo 2 PHONE");
assert.equal(queuePosterSteps("LOGIN")[1], "Entre na sua conta ou faça o cadastro", "passo 2 LOGIN");
assert.equal(queuePosterSteps("PHONE").length, 3, "3 passos");
assert.equal(queuePosterSteps("PHONE")[0], queuePosterSteps("LOGIN")[0], "passo 1 igual");
assert.equal(queuePosterSteps("PHONE")[2], queuePosterSteps("LOGIN")[2], "passo 3 igual");
assert.equal(queuePosterSteps("OUTRO")[1], "Entre na sua conta ou faça o cadastro", "valor desconhecido = conta");
n += 6;

console.log(`ok: ${n} casos`);

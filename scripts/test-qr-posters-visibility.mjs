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
const { showQueuePoster } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

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

console.log(`ok: ${n} casos`);

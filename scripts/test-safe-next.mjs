// Testes do destino depois do login (src/lib/auth/safe-next.ts), sem rede e sem banco.
// Roda com: node scripts/test-safe-next.mjs  (Node 23.6+ remove tipos do .ts sozinho)
import assert from "node:assert/strict";

const { safeNext } = await import("../src/lib/auth/safe-next.ts");
const O = "https://www.example.test";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FALHOU - ${name}`);
    throw e;
  }
}

test("caminhos da própria área passam como estão", () => {
  assert.equal(safeNext("/client", O, "client"), "/client");
  assert.equal(safeNext("/client/redefinir-senha", O, "client"), "/client/redefinir-senha");
  assert.equal(safeNext("/client/confirmar-whatsapp?x=1#y", O, "client"), "/client/confirmar-whatsapp?x=1#y");
  assert.equal(safeNext("/admin/config", O, "admin"), "/admin/config");
});

test("sem destino ou vazio: início da área", () => {
  assert.equal(safeNext(null, O, "client"), "/client");
  assert.equal(safeNext(undefined, O, "master"), "/master");
  assert.equal(safeNext("", O, "distributor"), "/distributor");
});

test("destino que não é caminho interno simples: início da área", () => {
  for (const v of [
    "@example.test",
    "//example.test",
    "/\\example.test",
    "\\\\example.test",
    "https://example.test/client",
    "javascript:alert(1)",
    "client",
    "/client@example.test",
    "/client/\u0000x",
    "/client/" + "a".repeat(600),
  ]) {
    assert.equal(safeNext(v, O, "client"), "/client", JSON.stringify(v));
  }
});

test("caminho de outra área ou parecido com a área: início da área", () => {
  assert.equal(safeNext("/admin", O, "client"), "/client");
  assert.equal(safeNext("/clientes", O, "client"), "/client");
  assert.equal(safeNext("/client/../admin", O, "client"), "/client");
  assert.equal(safeNext("/", O, "client"), "/client");
});

test("o resultado sempre começa com a área e uma barra só", () => {
  for (const v of ["/client/x", "//x", "@x", "/client?//x", null]) {
    const r = safeNext(v, O, "client");
    assert.ok(r === "/client" || r.startsWith("/client/") || r.startsWith("/client?"), r);
    assert.ok(!r.startsWith("//"), r);
  }
});

console.log(`\n${passed} testes ok`);

// Testes da validação de pedidos (#72), sem banco.
// Roda com: node scripts/test-order-input.mjs  (Node 23.6+ remove tipos do .ts sozinho)
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
registerHooks({
  resolve(specifier, context, next) {
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target && !path.extname(target)) {
      for (const ext of [".ts", "/index.ts"]) if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
    }
    return next(specifier, context);
  },
});

const { PlaceOrderSchema, SetOrderStatusSchema, placeOrderInputError, mapOrderRpcError, ORDER_GENERIC_ERROR } = await import("@/features/orders/schema");

const D = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const P = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const item = (qty = 1) => ({ productId: P, qty });

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}\n  ${err.message}`); process.exitCode = 1; }
}
const placeErr = (input) => {
  const r = PlaceOrderSchema.safeParse(input);
  return r.success ? null : placeOrderInputError(r.error);
};

test("pedido válido passa; nota vazia vira null", () => {
  const r = PlaceOrderSchema.parse({ distributorId: D, items: [item(2)], note: "  " });
  assert.equal(r.note, null);
  assert.equal(r.items[0].qty, 2);
});

test("50 itens ok, 51 itens recusado", () => {
  assert.equal(placeErr({ distributorId: D, items: Array.from({ length: 50 }, () => item()) }), null);
  assert.match(placeErr({ distributorId: D, items: Array.from({ length: 51 }, () => item()) }), /no máximo 50 itens/);
});

test("carrinho vazio recusado", () => {
  assert.equal(placeErr({ distributorId: D, items: [] }), "Carrinho vazio.");
});

test("qty 0, 1000, negativa e fracionada recusadas; 1 e 999 ok", () => {
  for (const q of [0, 1000, -3, 1.5]) assert.match(placeErr({ distributorId: D, items: [item(q)] }) ?? "", /Quantidade/, `aceitou qty ${q}`);
  for (const q of [1, 999]) assert.equal(placeErr({ distributorId: D, items: [item(q)] }), null);
});

test("nota com 501 caracteres recusada; 500 ok", () => {
  assert.match(placeErr({ distributorId: D, items: [item()], note: "a".repeat(501) }), /500 caracteres/);
  assert.equal(placeErr({ distributorId: D, items: [item()], note: "a".repeat(500) }), null);
});

test("ids inválidos recusados", () => {
  assert.equal(placeErr({ distributorId: "x", items: [item()] }), "Distribuidor inválido.");
  assert.ok(placeErr({ distributorId: D, items: [{ productId: "x' or 1=1", qty: 1 }] }));
});

test("status fora do enum recusado (PLACED, minúsculo, lixo)", () => {
  for (const s of ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]) assert.ok(SetOrderStatusSchema.safeParse({ orderId: D, status: s }).success);
  for (const s of ["PLACED", "confirmed", "DROP", ""]) assert.ok(!SetOrderStatusSchema.safeParse({ orderId: D, status: s }).success, `aceitou ${s}`);
  assert.ok(!SetOrderStatusSchema.safeParse({ orderId: "abc", status: "CONFIRMED" }).success);
});

test("erro da RPC vira mensagem pt-BR, nunca o texto cru", () => {
  assert.equal(mapOrderRpcError({ message: "ORDER_STALE" }), "Esse pedido já foi atualizado.");
  assert.equal(mapOrderRpcError({ message: "transição inválida" }), "Esse pedido já foi atualizado.");
  assert.equal(mapOrderRpcError({ message: "ORDER_DELIVERED" }), "Pedido entregue não pode ser cancelado.");
  assert.equal(mapOrderRpcError({ message: "estoque insuficiente para Pomada X" }), "Estoque insuficiente para confirmar este pedido.");
  for (const raw of ["forbidden", 'relation "orders" does not exist', "barbearia fora da carteira deste distribuidor", "", null]) {
    const out = mapOrderRpcError(raw === null ? null : { message: raw });
    assert.equal(out, ORDER_GENERIC_ERROR, `vazou: ${raw}`);
  }
});

console.log(`\n${passed} teste(s) passaram${process.exitCode ? ", com falhas" : ""}.`);

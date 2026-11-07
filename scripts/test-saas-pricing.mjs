// Teste da função de preço por competência (Epic 01 · S1). Sem runner: `npm run test:saas-pricing`.
// Node 22.18+ importa .ts direto (type stripping). Dados fictícios.
import assert from "node:assert/strict";
import { suggestPayment, buildLedger } from "../src/lib/billing/saas-pricing.ts";

const NOW = "2026-11-07T12:00:00Z";
const PERSONAL = { promoPriceBrl: 69.9, promoMonths: 2, fullPriceBrl: 129.9 };
const ESSENCIAL = { promoPriceBrl: 89.9, promoMonths: 2, fullPriceBrl: 189.9 };
const ADVANCE = { promoPriceBrl: null, promoMonths: 0, fullPriceBrl: 249.9 };

const pay = (from, to, amount, opts = {}) => ({
  amountBrl: amount,
  paidAt: opts.paidAt ?? `2026-11-0${from}T12:00:00Z`,
  paidUntil: opts.paidUntil ?? null,
  competenciaFrom: from,
  competenciaTo: to,
  expectedBrl: opts.expected ?? amount,
  partial: opts.partial ?? false,
});

let ok = 0;
function t(name, fn) {
  fn();
  ok++;
  console.log(`OK  ${name}`);
}

t("sem pagamento: 1ª mensalidade sugere promoção, selo até a competência 12/2026", () => {
  const s = suggestPayment(PERSONAL, [], 1, NOW);
  assert.equal(s.kind, "NEW");
  assert.equal(s.amountBrl, 69.9);
  assert.equal(s.firstCharge, true);
  assert.equal(s.label, "11/2026");
  assert.equal(s.promoUntilLabel, "12/2026");
});

t("1 competência paga → 2ª ainda é promoção", () => {
  const s = suggestPayment(PERSONAL, [pay(1, 1, 69.9)], 1, NOW);
  assert.equal(s.amountBrl, 69.9);
  assert.equal(s.competenciaFrom, 2);
  assert.equal(s.firstCharge, false);
  assert.equal(s.promoUntilLabel, "12/2026");
});

t("2 competências pagas → 3ª é preço cheio, sem selo", () => {
  const s = suggestPayment(PERSONAL, [pay(1, 1, 69.9), pay(2, 2, 69.9)], 1, NOW);
  assert.equal(s.amountBrl, 129.9);
  assert.equal(s.competenciaFrom, 3);
  assert.equal(s.promoUntilLabel, null);
  assert.equal(s.breakdown, null);
});

t("1ª mensalidade em duas partes conta como 1 competência; a próxima ainda é promoção", () => {
  const rows = [
    pay(1, 1, 34.95, { partial: true, expected: 69.9, paidAt: "2026-11-01T12:00:00Z" }),
    pay(1, 1, 34.95, { partial: true, expected: 69.9, paidAt: "2026-11-15T12:00:00Z" }),
  ];
  assert.equal(buildLedger(PERSONAL, rows, NOW).lastCompetencia, 1);
  const s = suggestPayment(PERSONAL, rows, 1, NOW);
  assert.equal(s.kind, "NEW");
  assert.equal(s.competenciaFrom, 2);
  assert.equal(s.amountBrl, 69.9);
});

t("parte faltando: sugere o restante da competência, não uma mensalidade nova", () => {
  const rows = [pay(1, 1, 34.95, { partial: true, expected: 69.9 })];
  const s = suggestPayment(PERSONAL, rows, 1, NOW);
  assert.equal(s.kind, "REMAINING");
  assert.equal(s.amountBrl, 34.95);
  assert.equal(s.text, "Falta R$ 34,95 da competência 11/2026");
});

t("vários meses cruzando a virada: 69,90 + 129,90 + 129,90 = 329,70 (a story diz 329,60: erro de soma), com divisão na nota", () => {
  const s = suggestPayment(PERSONAL, [pay(1, 1, 69.9)], 3, NOW);
  assert.equal(s.amountBrl, 329.7);
  assert.equal(s.competenciaFrom, 2);
  assert.equal(s.competenciaTo, 4);
  assert.equal(s.breakdown, "1× R$ 69,90 (promoção) + 2× R$ 129,90");
});

t("Essencial: mesma regra com 89,90 → 189,90", () => {
  assert.equal(suggestPayment(ESSENCIAL, [], 1, NOW).amountBrl, 89.9);
  assert.equal(suggestPayment(ESSENCIAL, [pay(1, 2, 179.8)], 1, NOW).amountBrl, 189.9);
  assert.equal(suggestPayment(ESSENCIAL, [pay(1, 1, 89.9)], 3, NOW).amountBrl, 469.7);
});

t("Advance: sempre 249,90, sem selo", () => {
  const s = suggestPayment(ADVANCE, [], 1, NOW);
  assert.equal(s.amountBrl, 249.9);
  assert.equal(s.promoUntilLabel, null);
  assert.equal(suggestPayment(ADVANCE, [pay(1, 5, 1249.5)], 2, NOW).amountBrl, 499.8);
});

t("condições gravadas ≠ tabela: segue o gravado (ex.: 59,90 × 3 → 119,90)", () => {
  const custom = { promoPriceBrl: 59.9, promoMonths: 3, fullPriceBrl: 119.9 };
  assert.equal(suggestPayment(custom, [pay(1, 2, 119.8)], 1, NOW).amountBrl, 59.9);
  assert.equal(suggestPayment(custom, [pay(1, 3, 179.7)], 1, NOW).amountBrl, 119.9);
});

t("pagamentos legados (sem competência) contam pelos meses que o paid_until andou", () => {
  const legacy = [
    { amountBrl: 69.9, paidAt: "2026-09-05T12:00:00Z", paidUntil: "2026-10-05T12:00:00Z", competenciaFrom: null, competenciaTo: null, expectedBrl: null, partial: false },
    { amountBrl: 139.8, paidAt: "2026-10-04T12:00:00Z", paidUntil: "2026-12-05T12:00:00Z", competenciaFrom: null, competenciaTo: null, expectedBrl: null, partial: false },
  ];
  const l = buildLedger(PERSONAL, legacy, NOW);
  assert.equal(l.lastCompetencia, 3);
  const s = suggestPayment(PERSONAL, legacy, 1, NOW);
  assert.equal(s.amountBrl, 129.9);
  assert.equal(s.label, "12/2026");
});

console.log(`\n${ok} casos OK`);

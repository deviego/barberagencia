/**
 * Preço da mensalidade do SaaS por COMPETÊNCIA (Epic 01 · S1).
 *
 * Função pura, sem imports: roda no servidor, no browser (painel do master) e no
 * teste (`node scripts/test-saas-pricing.mjs`). Toda a conta é em centavos.
 *
 * Regras (PM, 07/11/2026):
 *  - A promoção vale para as N primeiras competências (N = promoMonths), contando a
 *    partir da 1ª competência paga. Da N+1ª em diante, preço cheio.
 *  - Conta por competência, não por linha de pagamento: a 1ª mensalidade pode ser paga
 *    em duas partes (2 linhas, mesma competência).
 *  - O cálculo usa as condições GRAVADAS na barbearia, não a tabela atual.
 */

export type BillingTerms = {
  promoPriceBrl: number | null; // null = sem promoção
  promoMonths: number;
  fullPriceBrl: number;
};

export type PaymentRecord = {
  amountBrl: number;
  paidAt: string; // ISO
  paidUntil: string | null; // ISO
  competenciaFrom: number | null; // null = pagamento anterior ao schema-34 (legado)
  competenciaTo: number | null;
  expectedBrl: number | null; // valor esperado das competências cobertas, no momento do registro
  partial: boolean; // parte de uma competência paga em mais de uma vez
};

export type PriceLine = { count: number; unitBrl: number; promo: boolean };

export type Ledger = {
  /** Última competência coberta (0 = nenhuma paga). */
  lastCompetencia: number;
  /** Competência paga em partes que ainda não fechou o valor esperado. */
  open: { competencia: number; expectedBrl: number; paidBrl: number; remainingBrl: number } | null;
  /** Mês/ano da 1ª competência (âncora para os rótulos MM/AAAA). */
  anchor: { year: number; month: number }; // month 1–12
};

export type Suggestion =
  | {
      kind: "REMAINING";
      competencia: number;
      label: string; // "11/2026"
      amountBrl: number;
      text: string; // "Falta R$ 34,95 da competência 11/2026"
    }
  | {
      kind: "NEW";
      competenciaFrom: number;
      competenciaTo: number;
      label: string; // rótulo da 1ª competência coberta
      amountBrl: number;
      lines: PriceLine[];
      firstCharge: boolean;
      promoUntilLabel: string | null; // última competência de promoção, se a cobrança cair nela
      breakdown: string | null; // "1× R$ 69,90 (promoção) + 2× R$ 129,90" quando cruza a virada
    };

const cents = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;

export function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/** Preço de uma competência (1-based) segundo as condições gravadas. */
export function priceForCompetencia(terms: BillingTerms, competencia: number): { unitBrl: number; promo: boolean } {
  const promo = terms.promoPriceBrl != null && terms.promoMonths > 0 && competencia <= terms.promoMonths;
  return { unitBrl: promo ? (terms.promoPriceBrl as number) : terms.fullPriceBrl, promo };
}

/** Meses inteiros entre duas datas (pagamento legado: quantos meses o paid_until andou). */
function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.max(1, Math.round((b - a) / (30.4375 * 24 * 3600 * 1000)));
}

function ym(iso: string): { year: number; month: number } {
  const d = new Date(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function competenciaLabel(anchor: { year: number; month: number }, competencia: number): string {
  const idx = anchor.year * 12 + (anchor.month - 1) + (competencia - 1);
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${String(month).padStart(2, "0")}/${year}`;
}

/** Reconstrói quais competências já foram pagas a partir das linhas de saas_payments. */
export function buildLedger(terms: BillingTerms, payments: PaymentRecord[], nowIso: string): Ledger {
  const rows = [...payments].sort((x, y) => new Date(x.paidAt).getTime() - new Date(y.paidAt).getTime());
  let last = 0;
  let prevPaidUntil: string | null = null;
  const partialPaid = new Map<number, number>(); // competência → centavos pagos
  const partialExpected = new Map<number, number>(); // competência → centavos esperados

  for (const r of rows) {
    let from: number;
    let to: number;
    if (r.competenciaFrom != null) {
      from = r.competenciaFrom;
      to = r.competenciaTo ?? r.competenciaFrom;
    } else {
      // Legado (antes do schema-34): cada linha cobre os meses que o paid_until andou.
      const base: string =
        prevPaidUntil && new Date(prevPaidUntil).getTime() > new Date(r.paidAt).getTime() ? prevPaidUntil : r.paidAt;
      const n = r.paidUntil ? monthsBetween(base, r.paidUntil) : 1;
      from = last + 1;
      to = last + n;
    }
    if (r.partial && from === to) {
      partialPaid.set(from, (partialPaid.get(from) ?? 0) + cents(r.amountBrl));
      if (!partialExpected.has(from)) {
        partialExpected.set(from, cents(r.expectedBrl ?? priceForCompetencia(terms, from).unitBrl));
      }
    }
    last = Math.max(last, to);
    if (r.paidUntil) prevPaidUntil = r.paidUntil;
  }

  let open: Ledger["open"] = null;
  for (const [comp, exp] of partialExpected) {
    const paid = partialPaid.get(comp) ?? 0;
    if (paid < exp && (!open || comp > open.competencia)) {
      open = { competencia: comp, expectedBrl: reais(exp), paidBrl: reais(paid), remainingBrl: reais(exp - paid) };
    }
  }

  const anchor = rows.length > 0 ? ym(rows[0].paidAt) : ym(nowIso);
  return { lastCompetencia: last, open, anchor };
}

/** Valor sugerido para o próximo registro de pagamento cobrindo `months` competências. */
export function suggestPayment(terms: BillingTerms, payments: PaymentRecord[], months: number, nowIso: string): Suggestion {
  const ledger = buildLedger(terms, payments, nowIso);

  if (ledger.open) {
    const label = competenciaLabel(ledger.anchor, ledger.open.competencia);
    return {
      kind: "REMAINING",
      competencia: ledger.open.competencia,
      label,
      amountBrl: ledger.open.remainingBrl,
      text: `Falta ${formatBrl(ledger.open.remainingBrl)} da competência ${label}`,
    };
  }

  const n = Math.max(1, Math.min(24, Math.floor(months || 1)));
  const from = ledger.lastCompetencia + 1;
  const to = from + n - 1;
  const lines: PriceLine[] = [];
  let total = 0;
  for (let c = from; c <= to; c++) {
    const { unitBrl, promo } = priceForCompetencia(terms, c);
    total += cents(unitBrl);
    const prev = lines[lines.length - 1];
    if (prev && prev.unitBrl === unitBrl && prev.promo === promo) prev.count += 1;
    else lines.push({ count: 1, unitBrl, promo });
  }

  const inPromo = terms.promoPriceBrl != null && terms.promoMonths > 0 && from <= terms.promoMonths;
  const breakdown =
    lines.length > 1
      ? lines.map((l) => `${l.count}× ${formatBrl(l.unitBrl)}${l.promo ? " (promoção)" : ""}`).join(" + ")
      : null;

  return {
    kind: "NEW",
    competenciaFrom: from,
    competenciaTo: to,
    label: competenciaLabel(ledger.anchor, from),
    amountBrl: reais(total),
    lines,
    firstCharge: ledger.lastCompetencia === 0,
    promoUntilLabel: inPromo ? competenciaLabel(ledger.anchor, terms.promoMonths) : null,
    breakdown,
  };
}

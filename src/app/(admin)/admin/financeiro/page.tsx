import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { PosButton } from "@/features/admin/components/pos-drawer";
import { WithdrawButton } from "@/features/admin/components/withdraw-button";
import { formatBRL } from "@/lib/utils";
import { getClients, getFinance, getProducts, getServices } from "@/features/admin/data";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CARD_CREDIT: "Cartão",
  CARD_DEBIT: "Cartão",
  CASH: "Dinheiro",
  PLAN: "Plano",
};

export default async function FinanceiroPage() {
  const [fin, services, products, clients] = await Promise.all([
    getFinance(),
    getServices(),
    getProducts(),
    getClients(),
  ]);

  let acc = 0;
  const segments =
    fin.byMethod.length > 0
      ? fin.byMethod
          .map((m) => {
            const start = acc;
            acc += m.pct;
            return `${m.color} ${start}% ${acc}%`;
          })
          .join(", ")
      : "var(--bb-inset) 0% 100%";

  const receipts = fin.receipts as { amount_brl: number; method: string | null; occurred_at: string }[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">Financeiro</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-border px-3 py-2 text-caption text-text-2 capitalize">
            {format(new Date(), "MMMM yyyy", { locale: ptBR })}
          </span>
          <WithdrawButton />
          <PosButton services={services} products={products} clients={clients} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receitas" value={formatBRL(fin.revenue)} tone="success" />
        <KpiCard label="Despesas" value={formatBRL(fin.expenses)} tone="danger" />
        <KpiCard label="Fechamento" value={formatBRL(fin.closing)} tone="accent" />
        <KpiCard label="Saques" value={formatBRL(fin.withdrawals)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Recebimentos por método</div>
          <div className="flex items-center gap-6">
            <div
              className="relative flex h-40 w-40 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${segments})` }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-surface text-center">
                <span className="text-caption font-bold text-text tabular">{formatBRL(fin.revenue)}</span>
                <span className="text-[10px] uppercase text-text-muted">recebido</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {fin.byMethod.length === 0 && <li className="text-caption text-text-muted">Sem recebimentos no mês.</li>}
              {fin.byMethod.map((m) => (
                <li key={m.method} className="flex items-center gap-2 text-body">
                  <span className="h-3 w-3 rounded-sm" style={{ background: m.color }} />
                  <span className="w-16 text-text">{m.method}</span>
                  <span className="text-text tabular">{formatBRL(m.val)}</span>
                  <span className="text-text-muted tabular">{m.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Últimos recebimentos</div>
          <div className="flex flex-col gap-2">
            {receipts.length === 0 && <p className="text-caption text-text-muted">Nenhum recebimento ainda.</p>}
            {receipts.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2.5">
                <span className="text-caption text-text-muted tabular">
                  {format(new Date(r.occurred_at), "dd MMM · HH:mm", { locale: ptBR })}
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant="neutral">{METHOD_LABEL[r.method ?? ""] ?? "Outros"}</Badge>
                  <span className="text-body font-semibold text-success-strong tabular">{formatBRL(r.amount_brl)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

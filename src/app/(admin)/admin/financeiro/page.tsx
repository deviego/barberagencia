import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { FINANCE } from "@/features/admin/mock-data";

export default function FinanceiroPage() {
  // Monta o conic-gradient cumulativo por método de pagamento.
  let acc = 0;
  const segments = FINANCE.byMethod
    .map((m) => {
      const start = acc;
      acc += m.pct;
      return `${m.color} ${start}% ${acc}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Financeiro</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receitas" value={formatBRL(FINANCE.revenue)} />
        <KpiCard label="Despesas" value={formatBRL(FINANCE.expenses)} />
        <KpiCard label="Fechamento" value={formatBRL(FINANCE.closing)} accent />
        <KpiCard label="Saques" value={formatBRL(FINANCE.withdrawals)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Análise por método */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">
            Recebimentos por método
          </div>
          <div className="flex items-center gap-6">
            <div
              className="relative flex h-40 w-40 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${segments})` }}
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface text-caption text-text-muted">
                método
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {FINANCE.byMethod.map((m) => (
                <li key={m.method} className="flex items-center gap-2 text-body">
                  <span className="h-3 w-3 rounded-sm" style={{ background: m.color }} />
                  <span className="text-text">{m.method}</span>
                  <span className="text-text-muted tabular">{m.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recebimentos */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Últimos recebimentos</div>
          <div className="flex flex-col gap-2">
            {FINANCE.receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2.5"
              >
                <div>
                  <div className="text-body text-text">{r.client}</div>
                  <div className="text-caption text-text-muted tabular">{r.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="neutral">{r.method}</Badge>
                  <span className="text-body font-semibold text-accent tabular">
                    {formatBRL(r.amountBRL)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

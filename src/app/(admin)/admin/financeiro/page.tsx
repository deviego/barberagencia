import { ChevronDown, Download } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { PosButton } from "@/features/admin/components/pos-drawer";
import { formatBRL } from "@/lib/utils";
import { FINANCE } from "@/features/admin/mock-data";

const TABS = ["Por método", "Por barbeiro", "Por serviço"];

export default function FinanceiroPage() {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">Financeiro</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-caption text-text-2 transition-colors hover:border-accent">
            Julho 2026
            <ChevronDown size={14} />
          </button>
          <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent">
            <Download size={14} />
            Relatório
          </button>
          <PosButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receitas" value={formatBRL(FINANCE.revenue)} tone="success" />
        <KpiCard label="Despesas" value={formatBRL(FINANCE.expenses)} tone="danger" />
        <KpiCard label="Fechamento" value={formatBRL(FINANCE.closing)} tone="accent" />
        <KpiCard label="Saques" value={formatBRL(FINANCE.withdrawals)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Análise por método */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map((t, i) => (
              <span
                key={t}
                className={
                  i === 0
                    ? "rounded-md bg-accent-wash px-3 py-1.5 text-caption font-semibold text-accent"
                    : "rounded-md px-3 py-1.5 text-caption text-text-2"
                }
              >
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <div
              className="relative flex h-40 w-40 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${segments})` }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-surface">
                <span className="text-body font-bold text-text tabular">R$ 18,4k</span>
                <span className="text-[10px] uppercase text-text-muted">recebido</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {FINANCE.byMethod.map((m) => (
                <li key={m.method} className="flex items-center gap-2 text-body">
                  <span className="h-3 w-3 rounded-sm" style={{ background: m.color }} />
                  <span className="w-16 text-text">{m.method}</span>
                  <span className="text-text tabular">
                    {formatBRL(Math.round((m.pct / 100) * FINANCE.revenue))}
                  </span>
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
                  <span className="text-body font-semibold text-success-strong tabular">
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

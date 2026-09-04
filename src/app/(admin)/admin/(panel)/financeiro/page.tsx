import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { PosButton } from "@/features/admin/components/pos-drawer";
import { WithdrawButton } from "@/features/admin/components/withdraw-button";
import { FinanceFilter } from "@/features/admin/components/finance-filter";
import { RequestReportButton } from "@/features/admin/components/request-report-button";
import { BarberFinance } from "@/features/admin/components/barber-finance";
import { formatBRL } from "@/lib/utils";
import { getClients, getFinance, getFinanceByBarber, getFinanceDetails, getProducts, getServices } from "@/features/admin/data";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CARD_CREDIT: "Cartão",
  CARD_DEBIT: "Cartão",
  CASH: "Dinheiro",
  PLAN: "Plano",
};

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string }>;
}) {
  const params = await searchParams;
  const range: "day" | "week" | "month" = params.range === "week" || params.range === "month" ? params.range : "day";
  const today = format(new Date(), "yyyy-MM-dd");
  const dateStr = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const base = new Date(dateStr + "T00:00:00");

  let from: Date;
  let to: Date;
  let label: string;
  if (range === "week") {
    from = addDays(base, -base.getDay());
    to = addDays(from, 7);
    label = `Semana de ${format(from, "dd/MM")}`;
  } else if (range === "month") {
    from = new Date(base.getFullYear(), base.getMonth(), 1);
    to = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    label = format(base, "MMMM yyyy", { locale: ptBR });
  } else {
    from = base;
    to = addDays(base, 1);
    label = dateStr === today ? `Hoje · ${format(base, "dd/MM")}` : `Dia ${format(base, "dd/MM")}`;
  }

  const [fin, details, byBarber, services, products, clients] = await Promise.all([
    getFinance(from.toISOString(), to.toISOString()),
    getFinanceDetails(from.toISOString(), to.toISOString()),
    getFinanceByBarber(from.toISOString(), to.toISOString()),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h3 font-bold text-text">Financeiro</h1>
          <p className="text-caption capitalize text-text-muted">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WithdrawButton />
          <PosButton services={services} products={products} clients={clients} />
          <RequestReportButton />
        </div>
      </div>

      <FinanceFilter range={range} date={dateStr} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Receitas" value={formatBRL(fin.revenue)} tone="success" />
        <KpiCard label="Despesas" value={formatBRL(fin.expenses)} tone="danger" />
        <KpiCard label="Fechamento" value={formatBRL(fin.closing)} tone="accent" />
        <KpiCard label="Saques" value={formatBRL(fin.withdrawals)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recebimentos por método */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Recebimentos por método</div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div
              className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${segments})` }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-surface text-center">
                <span className="text-caption font-bold text-text tabular">{formatBRL(fin.revenue)}</span>
                <span className="text-[10px] uppercase text-text-muted">recebido</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {fin.byMethod.length === 0 && <li className="text-caption text-text-muted">Sem recebimentos no período.</li>}
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

        {/* Serviços mais vendidos (% por serviço) */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Serviços mais vendidos</div>
          {details.services.length === 0 ? (
            <p className="text-caption text-text-muted">Nenhum serviço vendido no período.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {details.services.slice(0, 8).map((s) => (
                <div key={s.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-caption">
                    <span className="truncate text-text">{s.name}</span>
                    <span className="shrink-0 text-text-muted tabular">
                      {s.qty}× · {formatBRL(s.value)} · <span className="font-semibold text-accent">{s.pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, s.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recebimentos detalhados (cliente + serviços) */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 text-overline uppercase text-text-muted">Recebimentos detalhados</div>
        {details.receipts.length === 0 ? (
          <p className="text-caption text-text-muted">Nenhuma venda no período.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {details.receipts.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-semibold text-text">{r.clientName}</span>
                    <span className="text-caption text-text-muted tabular">{format(new Date(r.datetime), "dd/MM · HH:mm")}</span>
                  </div>
                  <div className="truncate text-caption text-text-muted">
                    {r.items.length ? r.items.map((it) => `${it.qty > 1 ? it.qty + "× " : ""}${it.name}`).join(" · ") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="neutral">{METHOD_LABEL[r.method ?? ""] ?? "Outros"}</Badge>
                  <span className="text-body font-semibold text-success-strong tabular">{formatBRL(r.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Faturamento por barbeiro (equipe ou individual) */}
      <BarberFinance barbers={byBarber.barbers} detailed={byBarber.detailed} />
    </div>
  );
}

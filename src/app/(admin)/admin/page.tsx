import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { KPIS, PAYMENT_QUEUE, REQUESTS, REVENUE_6M, TODAY_AGENDA } from "@/features/admin/mock-data";

const STATUS_LABEL: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  CONFIRMED: { label: "Confirmado", variant: "success" },
  PENDING: { label: "Pendente", variant: "warning" },
  PLAN: { label: "Plano", variant: "accent" },
};

export default function AdminDashboard() {
  const max = Math.max(...REVENUE_6M.map((m) => m.value));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Dashboard</h1>

      {/* Banner de solicitações pendentes */}
      {REQUESTS.length > 0 && (
        <Link
          href="/admin/solicitacoes"
          className="flex items-center justify-between rounded-lg border border-warning bg-warning-bg px-5 py-4 transition-colors hover:border-warning-strong"
        >
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-warning-strong" />
            <span className="text-body font-semibold text-warning-strong">
              {REQUESTS.length} solicitações de agendamento aguardando confirmação
            </span>
          </div>
          <span className="text-caption font-semibold text-warning-strong">Ver agora →</span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={formatBRL(KPIS.revenue)} delta={`+${KPIS.revenueDelta}% vs mês anterior`} accent />
        <KpiCard label="Agendamentos hoje" value={String(KPIS.appointmentsToday)} />
        <KpiCard label="Assinantes ativos" value={String(KPIS.subscribers)} />
        <KpiCard label="Ocupação" value={`${KPIS.occupancy}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico de faturamento */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Faturamento — 6 meses</div>
          <div className="flex h-48 items-end gap-3">
            {REVENUE_6M.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${(m.value / max) * 100}%`,
                    background: m.current ? "var(--bb-accent)" : "var(--bb-n700)",
                  }}
                />
                <span className="text-caption text-text-muted">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agenda de hoje */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Agenda de hoje</div>
          <div className="flex flex-col gap-2">
            {TODAY_AGENDA.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2.5">
                <span className="text-body font-semibold text-text tabular">{a.time}</span>
                <div className="flex-1">
                  <div className="text-body text-text">{a.client}</div>
                  <div className="text-caption text-text-muted">{a.service} · {a.barber}</div>
                </div>
                <Badge variant={STATUS_LABEL[a.status].variant}>{STATUS_LABEL[a.status].label}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fila de confirmação de pagamento */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 text-overline uppercase text-text-muted">Confirmação de pagamento</div>
        <div className="flex flex-col gap-2">
          {PAYMENT_QUEUE.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border border-warning bg-warning-bg px-4 py-3"
            >
              <div>
                <div className="text-body font-semibold text-text">{p.client}</div>
                <div className="text-caption text-text-muted">
                  {p.service} · {p.method} · {formatBRL(p.amountBRL)}
                </div>
              </div>
              <Button size="sm">
                <Check size={16} />
                Confirmar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

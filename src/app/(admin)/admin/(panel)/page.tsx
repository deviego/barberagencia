import Link from "next/link";
import { format } from "date-fns";
import { Bell, Plus } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PosButton } from "@/features/admin/components/pos-drawer";
import { formatBRL } from "@/lib/utils";
import { getClients, getDashboard, getProducts, getServices } from "@/features/admin/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}
const STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  REQUESTED: { label: "Aguardando", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "success" },
  ALT_OFFERED: { label: "Outro horário", variant: "info" },
  DONE: { label: "Atendido", variant: "neutral" },
  CANCELLED: { label: "Cancelado", variant: "danger" },
  EXPIRED: { label: "Expirado", variant: "neutral" },
};

export default async function AdminDashboard() {
  const [d, services, products, clients] = await Promise.all([
    getDashboard(),
    getServices(),
    getProducts(),
    getClients(),
  ]);
  const max = Math.max(1, ...d.revenue6m.map((m) => m.value));
  const today = d.today as { id: string; start_at: string; status: string; clients: unknown; services: unknown; combo_plans: unknown }[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h3 font-bold text-text">Dashboard</h1>
          <p className="text-caption text-text-muted capitalize">
            {format(new Date(), "EEEE, dd 'de' MMMM")} — {d.apptsToday} agendamentos hoje
          </p>
        </div>
        <div className="flex gap-3">
          <PosButton variant="outline" services={services} products={products} clients={clients} />
          <Link href="/admin/agenda">
            <Button>
              <Plus size={16} />
              Novo agendamento
            </Button>
          </Link>
        </div>
      </div>

      {d.pending > 0 && (
        <Link
          href="/admin/solicitacoes"
          className="flex items-center justify-between rounded-lg border border-warning bg-warning-bg px-5 py-4 transition-colors hover:border-warning-strong"
        >
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-warning-strong" />
            <span className="text-body font-semibold text-warning-strong">
              {d.pending} solicitação(ões) aguardando confirmação
            </span>
          </div>
          <span className="text-caption font-semibold text-warning-strong">Ver agora →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento (mês)" value={formatBRL(d.revenueMonth)} accent />
        <KpiCard label="Agendamentos hoje" value={String(d.apptsToday)} />
        <KpiCard label="Assinantes ativos" value={String(d.subscribers)} />
        <KpiCard label="Solicitações pendentes" value={String(d.pending)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Faturamento — 6 meses</div>
          <div className="flex h-48 items-end gap-3">
            {d.revenue6m.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: `${(m.value / max) * 100}%`, background: m.current ? "var(--bb-accent)" : "var(--bb-n700)", minHeight: 2 }}
                />
                <span className="text-caption uppercase text-text-muted">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">Agenda de hoje</div>
          <div className="flex flex-col gap-2">
            {today.length === 0 && <p className="text-caption text-text-muted">Nenhum agendamento hoje.</p>}
            {today.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2.5">
                <span className="text-body font-semibold text-text tabular">
                  {format(new Date(a.start_at), "HH:mm")}
                </span>
                <div className="flex-1">
                  <div className="text-body text-text">{one(a.clients as { name: string }[] | { name: string })?.name ?? "Cliente"}</div>
                  <div className="text-caption text-text-muted">
                    {one(a.services as { name: string }[] | { name: string })?.name ??
                      one(a.combo_plans as { name: string }[] | { name: string })?.name ??
                      "Serviço"}
                  </div>
                </div>
                <Badge variant={(STATUS[a.status] ?? STATUS.REQUESTED).variant}>
                  {(STATUS[a.status] ?? STATUS.REQUESTED).label}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { BILLING } from "@/features/platform/mock-data";

const STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  PAID: { label: "Pago", variant: "success" },
  PENDING: { label: "Pendente", variant: "warning" },
  TRIAL: { label: "Trial", variant: "info" },
  OVERDUE: { label: "Vencido", variant: "danger" },
};

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Billing da plataforma</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="MRR" value={formatBRL(BILLING.mrr)} accent />
        <KpiCard label="Tenants" value={String(BILLING.tenants)} />
        <KpiCard label="Inadimplência" value={String(BILLING.overdue)} />
        <KpiCard label="Churn" value={`${BILLING.churnPct}%`} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              <th className="px-4 py-3 font-semibold">Barbearia</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Vencimento</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {BILLING.invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border-subtle">
                <td className="px-4 py-3 text-text">{inv.tenant}</td>
                <td className="px-4 py-3 text-text-2">{inv.plan}</td>
                <td className="px-4 py-3 text-text tabular">{formatBRL(inv.amountBRL)}</td>
                <td className="px-4 py-3 text-text-2 tabular">{inv.due}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS[inv.status].variant}>{STATUS[inv.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

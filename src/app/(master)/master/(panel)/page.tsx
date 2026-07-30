import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/features/platform/components/bar-chart";
import { getPlatformStats } from "@/features/platform/data";
import { formatBRL } from "@/lib/utils";

export default async function MasterDashboard() {
  const s = await getPlatformStats();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h3 font-bold text-text">Painel da plataforma</h1>
          <p className="text-caption text-text-muted">Visão geral da barberagencia — o avanço de todas as barbearias</p>
        </div>
        <div className="flex gap-3">
          <Link href="/master/barbearias">
            <Button variant="outline">
              <Building2 size={16} />
              Ver barbearias
            </Button>
          </Link>
          <Link href="/master/onboarding">
            <Button>
              <Plus size={16} />
              Nova barbearia
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Barbearias" value={String(s.barbershops)} delta={`${s.activeBarbershops} ativas`} accent />
        <KpiCard label="Assinantes ativos" value={String(s.subscribers)} />
        <KpiCard label="Faturamento (mês)" value={formatBRL(s.revenueMonth)} />
        <KpiCard label="Receita recorrente (MRR)" value={formatBRL(s.mrr)} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <BarChart title="Barbearias — crescimento (6m)" data={s.barbershops6m} />
        <BarChart title="Assinantes — crescimento (6m)" data={s.subscribers6m} />
        <BarChart title="Faturamento — 6 meses" data={s.revenue6m} format={formatBRL} />
      </div>
    </div>
  );
}

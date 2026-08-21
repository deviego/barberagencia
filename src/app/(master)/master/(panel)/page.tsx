import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/features/platform/components/bar-chart";
import { OrbitView } from "@/features/platform/components/orbit-view";
import { ViewToggle } from "@/features/platform/components/view-toggle";
import { getPlatformStats, getTenants } from "@/features/platform/data";
import { formatBRL } from "@/lib/utils";

export default async function MasterDashboard({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const classic = view === "classico";

  const [s, tenants] = await Promise.all([getPlatformStats(), classic ? Promise.resolve([]) : getTenants()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h3 font-bold text-text">Painel da plataforma</h1>
          <p className="text-caption text-text-muted">Visão geral da Barber Agência — o avanço de todas as barbearias</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle current={classic ? "classico" : "orbita"} />
          <Link href="/master/onboarding">
            <Button>
              <Plus size={16} /> Nova barbearia
            </Button>
          </Link>
        </div>
      </div>

      {classic ? (
        <>
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
        </>
      ) : (
        <>
          <OrbitView
            centerLabel="BA"
            barbershops={s.barbershops}
            mrr={s.mrr}
            tenants={tenants.map((t) => ({
              id: t.id,
              name: t.name,
              saasPlan: t.saasPlan,
              subscribers: t.subscribers,
              revenueMonth: t.revenueMonth,
              status: t.status,
            }))}
          />
          <div className="flex justify-center">
            <Link href="/master/barbearias">
              <Button variant="outline">
                <Building2 size={16} /> Ver todas as barbearias
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

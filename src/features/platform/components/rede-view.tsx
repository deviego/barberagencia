"use client";

import { useMemo, useState } from "react";
import { EllipsisVertical, Plus } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { NETWORK_ADMINS, NETWORK_UNITS } from "@/features/platform/mock-data";

export function RedeView() {
  const [unit, setUnit] = useState<string>("all");

  const shown = unit === "all" ? NETWORK_UNITS : NETWORK_UNITS.filter((u) => u.id === unit);
  const agg = useMemo(() => {
    const revenue = shown.reduce((s, u) => s + u.revenue, 0);
    const appts = shown.reduce((s, u) => s + u.appointments, 0);
    const subs = shown.reduce((s, u) => s + u.subscribers, 0);
    const occ = Math.round(shown.reduce((s, u) => s + u.occupancy, 0) / shown.length);
    return { revenue, appts, subs, occ };
  }, [shown]);

  const maxRev = Math.max(...NETWORK_UNITS.map((u) => u.revenue));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h3 font-bold text-text">Consolidado da rede</h1>
          <p className="text-caption text-text-muted">Julho 2026 · todas as unidades</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={unit === "all"} onClick={() => setUnit("all")}>
            Todas
          </Chip>
          {NETWORK_UNITS.map((u) => (
            <Chip key={u.id} active={unit === u.id} onClick={() => setUnit(u.id)}>
              {u.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* KPIs com tendência */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={formatBRL(agg.revenue)} delta="+9% vs. junho" accent />
        <KpiCard label="Agendamentos no mês" value={String(agg.appts)} delta="+11% vs. junho" />
        <KpiCard label="Assinantes" value={String(agg.subs)} delta="+7 este mês" />
        <KpiCard label="Ocupação média" value={`${agg.occ}%`} delta="+4pp" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Comparativo por filial */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 text-overline uppercase text-text-muted">
            Comparativo entre filiais — faturamento
          </div>
          <div className="flex flex-col gap-3">
            {NETWORK_UNITS.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-caption text-text-2">{u.name}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-pill bg-inset">
                  <div
                    className="h-full rounded-pill"
                    style={{ width: `${(u.revenue / maxRev) * 100}%`, background: u.barColor }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-caption text-text tabular">
                  {formatBRL(u.revenue)}
                </span>
              </div>
            ))}
          </div>

          {/* Mini-tabela comparativa */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-left text-overline uppercase text-text-muted">
                  <th className="py-2 font-semibold">Filial</th>
                  <th className="py-2 font-semibold">Assinantes</th>
                  <th className="py-2 font-semibold">Ocupação</th>
                  <th className="py-2 font-semibold">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {NETWORK_UNITS.map((u) => (
                  <tr key={u.id} className="border-t border-border-subtle">
                    <td className="py-2 text-text">{u.name}</td>
                    <td className="py-2 text-text-2 tabular">{u.subscribers}</td>
                    <td className="py-2 text-text-2 tabular">{u.occupancy}%</td>
                    <td className="py-2 text-text-2 tabular">{formatBRL(u.ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admins de unidade */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-overline uppercase text-text-muted">Admins de unidade</div>
            <Button size="sm">
              <Plus size={14} />
              Convidar
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {NETWORK_ADMINS.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2.5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-caption font-bold"
                  style={{ background: a.color, color: a.fg }}
                >
                  {a.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body text-text">{a.name}</div>
                  <div className="text-caption text-text-muted">
                    {a.unit} · {a.role}
                  </div>
                </div>
                <Badge variant={a.status === "ACTIVE" ? "success" : "info"}>
                  {a.status === "ACTIVE" ? "Ativo" : "Convidado"}
                </Badge>
                <button
                  className="rounded-md p-1 text-text-muted transition-colors hover:text-accent"
                  aria-label="Mais ações"
                >
                  <EllipsisVertical size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-pill border px-4 py-1.5 text-caption transition-colors",
        active ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
      )}
    >
      {children}
    </button>
  );
}

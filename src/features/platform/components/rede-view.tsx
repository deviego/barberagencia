"use client";

import { useMemo, useState } from "react";
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
    const subs = shown.reduce((s, u) => s + u.subscribers, 0);
    const occ = Math.round(shown.reduce((s, u) => s + u.occupancy, 0) / shown.length);
    const ticket = Math.round(shown.reduce((s, u) => s + u.ticket, 0) / shown.length);
    return { revenue, subs, occ, ticket };
  }, [shown]);

  const maxRev = Math.max(...NETWORK_UNITS.map((u) => u.revenue));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Consolidado da rede</h1>

      {/* Filtro por unidade */}
      <div className="flex flex-wrap gap-2">
        <Chip active={unit === "all"} onClick={() => setUnit("all")}>
          Todas
        </Chip>
        {NETWORK_UNITS.map((u) => (
          <Chip key={u.id} active={unit === u.id} onClick={() => setUnit(u.id)}>
            {u.name.replace("Oliveira 01 — ", "")}
          </Chip>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={formatBRL(agg.revenue)} accent />
        <KpiCard label="Assinantes" value={String(agg.subs)} />
        <KpiCard label="Ocupação média" value={`${agg.occ}%`} />
        <KpiCard label="Ticket médio" value={formatBRL(agg.ticket)} />
      </div>

      {/* Comparativo por filial */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 text-overline uppercase text-text-muted">Faturamento por filial</div>
        <div className="flex flex-col gap-3">
          {NETWORK_UNITS.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-caption text-text-2">{u.name}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-pill bg-inset">
                <div
                  className="h-full rounded-pill bg-accent"
                  style={{ width: `${(u.revenue / maxRev) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-caption text-text tabular">
                {formatBRL(u.revenue)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Admins de unidade */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-overline uppercase text-text-muted">Admins de unidade</div>
          <Button size="sm" variant="outline">
            Convidar admin
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {NETWORK_ADMINS.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-2.5"
            >
              <div>
                <div className="text-body text-text">{a.name}</div>
                <div className="text-caption text-text-muted">{a.unit}</div>
              </div>
              <Badge variant={a.status === "ACTIVE" ? "success" : "info"}>
                {a.status === "ACTIVE" ? "Ativo" : "Convite enviado"}
              </Badge>
            </div>
          ))}
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

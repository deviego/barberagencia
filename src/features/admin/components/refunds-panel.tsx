"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Reembolsos ainda mockados (fluxo de cancelamento/estorno entra na leva de pagamentos).
const REFUNDS = [
  { id: "rf1", client: "William Santos", detail: "Cancelou Combo Mensal 02", action: "Devolver 1 corte ao saldo", cta: "Aprovar devolução" },
  { id: "rf2", client: "João Silva", detail: "Cancelou Barba Especial (avulso · PIX)", action: "Estornar R$ 40,00", cta: "Aprovar estorno" },
];

export function RefundsPanel() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div>
        <div className="text-overline uppercase text-text-muted">Cancelamentos & reembolsos</div>
        <p className="text-caption text-text-muted">
          Cancelamento até 2h antes = reembolso integral; cortes de plano voltam ao saldo.
        </p>
      </div>
      {REFUNDS.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle px-4 py-3"
        >
          <div>
            <div className="text-body font-semibold text-text">{r.client}</div>
            <div className="text-caption text-text-muted">
              {r.detail} · {r.action}
            </div>
          </div>
          {done[r.id] ? (
            <Badge variant="success">Aprovado</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDone((d) => ({ ...d, [r.id]: true }))}>
              {r.cta}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

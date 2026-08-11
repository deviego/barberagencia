"use client";

import { useState, useTransition } from "react";
import { Check, ArrowUpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setTenantPlan, resolveUpgradeRequest } from "../actions";
import { PLAN_ORDER, planLabel, normalizeSaasPlan } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";
import type { UpgradeRequest } from "../data";

/** Painel do MASTER: troca o plano da barbearia e resolve solicitações de upgrade. */
export function MasterPlanPanel({
  tenantId,
  plan,
  requests,
}: {
  tenantId: string;
  plan: string;
  requests: UpgradeRequest[];
}) {
  const [current, setCurrent] = useState<SaasPlanKey>(normalizeSaasPlan(plan));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const pendingReqs = requests.filter((r) => r.status === "PENDING");

  function change(p: SaasPlanKey) {
    setMsg(null);
    startTransition(async () => {
      const res = await setTenantPlan(tenantId, p);
      if (res.ok) {
        setCurrent(p);
        setMsg("Plano atualizado.");
      } else setMsg(res.error ?? "Falha.");
    });
  }

  function resolve(id: string, approve: boolean) {
    startTransition(async () => {
      const res = await resolveUpgradeRequest(id, approve);
      if (res.ok && approve) {
        // aprovado: o plano passa a ser o solicitado
        const req = requests.find((r) => r.id === id);
        if (req?.requested_plan) setCurrent(normalizeSaasPlan(req.requested_plan));
      }
      setMsg(res.ok ? "Solicitação resolvida." : res.error ?? "Falha.");
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h5 font-bold text-text">Plano & upgrades</h2>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="text-caption text-text-2">Plano da barbearia</div>
        <div className="flex flex-wrap gap-2">
          {PLAN_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => change(p)}
              disabled={pending}
              className={`rounded-pill border px-4 py-2 text-body transition-colors ${
                current === p ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
              }`}
            >
              {planLabel(p)}
            </button>
          ))}
        </div>
        {msg && <span className="text-caption text-text-2">{msg}</span>}
      </div>

      {pendingReqs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-caption font-semibold text-text-2">Solicitações de upgrade</div>
          {pendingReqs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
              <ArrowUpCircle size={16} className="text-accent" />
              <span className="text-body text-text">
                {planLabel(normalizeSaasPlan(r.current_plan))} → <strong>{planLabel(normalizeSaasPlan(r.requested_plan))}</strong>
              </span>
              {r.reason && <span className="text-caption text-text-muted">“{r.reason}”</span>}
              <Badge variant="warning" className="ml-auto">Pendente</Badge>
              <Button size="sm" onClick={() => resolve(r.id, true)} loading={pending}>
                <Check size={14} /> Aprovar
              </Button>
              <Button size="sm" variant="outline" onClick={() => resolve(r.id, false)} disabled={pending}>
                Recusar
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

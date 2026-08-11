"use client";

import { Lock, Check, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "./upgrade-button";
import {
  DISPLAY_FEATURES,
  LIMIT_LABEL,
  minPlanForFeature,
  planLabel,
  type FeatureKey,
  type NumericLimitKey,
} from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";

export type PlanUsageView = {
  plan: SaasPlanKey;
  planLabel: string;
  gated: boolean;
  limits: Record<NumericLimitKey, number>;
  usage: Record<NumericLimitKey, number>;
  features: Record<FeatureKey, boolean>;
};

const LIMIT_ORDER: NumericLimitKey[] = [
  "professionals.limit",
  "clients.limit",
  "appointments.monthly",
  "admins.limit",
];

function Bar({ used, max }: { used: number; max: number }) {
  const unlimited = max < 0;
  const pct = unlimited ? 6 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const near = !unlimited && used >= max * 0.8;
  const full = !unlimited && used >= max;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-inset">
      <div
        className={`h-full rounded-pill ${full ? "bg-danger" : near ? "bg-warning-strong" : "bg-accent"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Seção "Meu plano": uso x limites, recursos bloqueados e botão de upgrade. */
export function PlanUsage({ view }: { view: PlanUsageView }) {
  const locked = DISPLAY_FEATURES.filter((f) => !view.features[f.key]);
  const included = DISPLAY_FEATURES.filter((f) => view.features[f.key]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="meu-plano">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-text-muted" />
          <div className="text-overline uppercase text-text-muted">Meu plano</div>
          <Badge variant="accent">{view.planLabel}</Badge>
          {!view.gated && <Badge variant="success">Teste — tudo liberado</Badge>}
        </div>
        <UpgradeButton currentPlan={view.plan} label="Fazer upgrade" />
      </div>

      {/* Uso x limites */}
      <div className="grid gap-4 sm:grid-cols-2">
        {LIMIT_ORDER.map((k) => {
          const used = view.usage[k];
          const max = view.limits[k];
          const unlimited = max < 0;
          return (
            <div key={k} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-caption">
                <span className="text-text-2">{LIMIT_LABEL[k]}</span>
                <span className={`tabular ${view.gated && !unlimited && used >= max ? "font-semibold text-danger" : "text-text-muted"}`}>
                  {used} / {unlimited ? "∞" : max}
                </span>
              </div>
              <Bar used={used} max={max} />
            </div>
          );
        })}
      </div>

      {/* Recursos bloqueados */}
      {locked.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <div className="text-caption font-semibold text-text-2">Recursos não incluídos no seu plano</div>
          <div className="flex flex-col gap-1.5">
            {locked.map((f) => {
              const need = minPlanForFeature(f.key);
              return (
                <div key={f.key} className="flex items-center gap-2 text-caption text-text-muted">
                  <Lock size={13} className="shrink-0" />
                  <span className="text-text-2">{f.label}</span>
                  {need && <Badge variant="neutral">{planLabel(need)}+</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recursos incluídos */}
      {included.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {included.map((f) => (
            <span key={f.key} className="flex items-center gap-1.5 text-caption text-text-2">
              <Check size={13} className="text-success-strong" /> {f.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { Lock } from "lucide-react";
import { UpgradeButton } from "./upgrade-button";
import { planLabel } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";

/** Estado "recurso bloqueado" com CTA de upgrade — usado em páginas gated. */
export function LockedFeature({
  title,
  description,
  currentPlan,
  needPlan,
}: {
  title: string;
  description?: string;
  currentPlan: SaasPlanKey;
  needPlan: SaasPlanKey | null;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-inset text-text-muted">
        <Lock size={26} />
      </div>
      <div>
        <h2 className="text-h5 font-bold text-text">{title}</h2>
        <p className="mx-auto mt-1 max-w-md text-caption text-text-2">
          {description ?? "Este recurso não está incluído no seu plano atual."}
          {needPlan && ` Disponível a partir do plano ${planLabel(needPlan)}.`}
        </p>
      </div>
      <UpgradeButton
        currentPlan={currentPlan}
        suggestPlan={needPlan}
        size="md"
        label={needPlan ? `Fazer upgrade para ${planLabel(needPlan)}` : "Fazer upgrade"}
        context={`${title} está disponível ${needPlan ? `no plano ${planLabel(needPlan)}` : "em um plano superior"}.`}
      />
    </div>
  );
}

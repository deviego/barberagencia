"use client";

import { useState, useTransition } from "react";
import { ArrowUpCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestUpgrade } from "../actions";
import { PLAN_ORDER, planLabel } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";

/** Botão + modal "Solicitar upgrade" (o master recebe e troca o plano). */
export function UpgradeButton({
  currentPlan,
  suggestPlan,
  context,
  size = "sm",
  variant = "primary",
  label = "Fazer upgrade",
}: {
  currentPlan: SaasPlanKey;
  suggestPlan?: SaasPlanKey | null;
  context?: string;
  size?: "sm" | "md";
  variant?: "primary" | "outline" | "secondary";
  label?: string;
}) {
  const idx = PLAN_ORDER.indexOf(currentPlan);
  const defaultTarget = suggestPlan ?? PLAN_ORDER[Math.min(idx + 1, PLAN_ORDER.length - 1)];
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<SaasPlanKey>(defaultTarget);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const options = PLAN_ORDER.filter((p) => PLAN_ORDER.indexOf(p) > idx);

  function submit() {
    startTransition(async () => {
      const res = await requestUpgrade({ requestedPlan: target, reason });
      if (res.ok) setDone(true);
    });
  }

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <ArrowUpCircle size={15} /> {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-[440px] max-w-full rounded-lg border border-border bg-elevated p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-h5 font-bold text-text">Solicitar upgrade de plano</h3>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-text-muted hover:text-text">
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success-strong">
                  <Check size={22} />
                </div>
                <p className="text-body font-semibold text-text">Solicitação enviada!</p>
                <p className="text-caption text-text-2">Nossa equipe vai liberar o novo plano em breve.</p>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="mt-2">
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                {context && <p className="mt-2 text-caption text-text-2">{context}</p>}
                <p className="mt-3 text-caption text-text-muted">Plano atual: {planLabel(currentPlan)}</p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {options.map((p) => (
                    <button
                      key={p}
                      onClick={() => setTarget(p)}
                      className={`rounded-pill border px-4 py-2 text-body transition-colors ${
                        target === p ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
                      }`}
                    >
                      {planLabel(p)}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Mensagem (opcional)"
                  className="mt-3 w-full resize-none rounded-md border border-border bg-inset px-3 py-2 text-caption text-text"
                />

                <div className="mt-4 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={submit} loading={pending}>
                    Enviar solicitação
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

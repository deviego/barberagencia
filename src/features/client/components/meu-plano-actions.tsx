"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmModal } from "@/components/ui/modal";
import { formatBRL, cn } from "@/lib/utils";
import { requestPlanChange, requestPlanCancel } from "@/features/client/actions";

interface Combo {
  id: string;
  name: string;
  cuts: number;
  price_brl: number;
}

export function MeuPlanoActions({
  combos,
  currentComboName,
  hasPending,
}: {
  combos: Combo[];
  currentComboName?: string;
  hasPending: boolean;
}) {
  const router = useRouter();
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submitChange() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await requestPlanChange(selected);
      if (res.ok) {
        setChangeOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  const options = combos.filter((c) => c.name !== currentComboName);

  return (
    <div className="mt-4 flex gap-3">
      <Button variant="outline" size="sm" disabled={hasPending} onClick={() => setChangeOpen(true)}>
        Trocar plano
      </Button>
      <Button variant="ghost" size="sm" disabled={hasPending} loading={pending} onClick={() => setCancelOpen(true)}>
        Cancelar assinatura
      </Button>

      <Drawer
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        title="Trocar de plano"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setChangeOpen(false)}>
              Cancelar
            </Button>
            <Button loading={pending} disabled={!selected} onClick={submitChange}>
              Solicitar troca
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-caption text-text-muted">
            A troca precisa ser confirmada pela barbearia. Seu plano atual continua ativo até a aprovação.
          </p>
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn(
                "flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors",
                selected === c.id ? "border-2 border-accent bg-accent-wash" : "border-border hover:border-accent"
              )}
            >
              <div>
                <div className="text-body font-semibold text-text">{c.name}</div>
                <div className="text-caption text-text-muted">{c.cuts} cortes/mês</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-body font-bold text-accent tabular">{formatBRL(c.price_brl)}</span>
                {selected === c.id && <Check size={16} className="text-accent" />}
              </div>
            </button>
          ))}
          {options.length === 0 && <p className="text-caption text-text-muted">Nenhum outro plano disponível.</p>}
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
      </Drawer>

      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Solicitar cancelamento?"
        message="O cancelamento será enviado à barbearia para confirmação. Seu plano continua ativo até lá."
        confirmLabel="Solicitar cancelamento"
        danger
        onConfirm={() =>
          startTransition(async () => {
            await requestPlanCancel();
            router.refresh();
          })
        }
      />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { planBenefits } from "@/lib/plan";
import { subscribeCombo } from "@/features/client/actions";

interface Service { id: string; name: string; duration_min: number; price_brl: number }
interface Combo { id: string; name: string; cuts: number; scope: string | null; price_brl: number }

export function ServicosView({ services, combos }: { services: Service[]; combos: Combo[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCombo = combos.some((c) => c.id === selected);

  function onContinue() {
    if (!selected) return;
    if (isCombo) {
      setError(null);
      startTransition(async () => {
        const res = await subscribeCombo(selected);
        if (res.ok) router.push("/");
        else setError(res.error);
      });
    } else {
      router.push("/agendar");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Escolha o serviço</h1>
        <p className="text-body text-text-2">Avulsos ou assinaturas mensais (combos).</p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Avulsos</div>
        {services.map((s) => (
          <Card
            key={s.id}
            selected={selected === s.id}
            onSelect={() => setSelected(s.id)}
            title={s.name}
            subtitle={`Tempo médio ~${s.duration_min} min`}
            price={formatBRL(s.price_brl)}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Assinaturas mensais</div>
        {combos.map((c) => (
          <Card
            key={c.id}
            selected={selected === c.id}
            onSelect={() => setSelected(c.id)}
            title={c.name}
            benefits={planBenefits(c.cuts, c.scope)}
            price={`${formatBRL(c.price_brl)}/mês`}
            assinatura
          />
        ))}
      </section>

      {error && <p className="text-caption text-danger">{error}</p>}

      <div className="sticky bottom-24 md:bottom-4">
        <Button
          size="lg"
          className="w-full"
          disabled={!selected}
          loading={pending}
          onClick={onContinue}
        >
          {isCombo ? "Assinar combo (pagamento no local)" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}

function Card({
  selected,
  onSelect,
  title,
  subtitle,
  benefits,
  price,
  assinatura,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  benefits?: string[];
  price: string;
  assinatura?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex gap-3 rounded-lg border bg-surface p-4 text-left transition-colors",
        benefits ? "items-start" : "items-center",
        selected ? "border-2 border-accent bg-accent-wash" : "border-border hover:border-accent"
      )}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-inset text-accent">
        <Scissors size={18} />
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-semibold text-text">{title}</span>
          {assinatura && <Badge variant="accent">Assinatura</Badge>}
          {selected && <Badge variant="success">Selecionado</Badge>}
        </div>
        {benefits ? (
          <ul className="mt-1.5 flex flex-col gap-1">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-caption text-text-2">
                <Check size={13} className="mt-0.5 flex-shrink-0 text-accent" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-1 text-caption text-text-muted">
            <Clock size={12} /> {subtitle}
          </div>
        )}
      </div>
      <div className="whitespace-nowrap text-body font-bold text-accent tabular">{price}</div>
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { COMBOS, SERVICES } from "@/features/client/mock-data";
import { cn } from "@/lib/utils";

export default function ServicosPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const isCombo = COMBOS.some((c) => c.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Escolha seu serviço</h1>
        <p className="text-body text-text-2">Avulsos ou assinaturas mensais (combos).</p>
      </div>

      {/* Avulsos */}
      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Serviços avulsos</div>
        {SERVICES.map((s) => (
          <SelectableCard
            key={s.id}
            selected={selected === s.id}
            onSelect={() => setSelected(s.id)}
            title={s.name}
            subtitle={`${s.durationMin} min`}
            price={formatBRL(s.priceBRL)}
          />
        ))}
      </section>

      {/* Assinaturas */}
      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Assinaturas mensais</div>
        {COMBOS.map((c) => (
          <SelectableCard
            key={c.id}
            selected={selected === c.id}
            onSelect={() => setSelected(c.id)}
            title={c.name}
            subtitle={`${c.cuts} cortes/mês · ${c.scope}`}
            price={`${formatBRL(c.priceBRL)}/mês`}
          />
        ))}
      </section>

      <div className="sticky bottom-24 md:bottom-4">
        <Button
          size="lg"
          className="w-full"
          disabled={!selected}
          onClick={() => router.push(isCombo ? "/revisao" : "/agendar")}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

function SelectableCard({
  selected,
  onSelect,
  title,
  subtitle,
  price,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  price: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-surface p-4 text-left transition-colors",
        selected ? "border-2 border-accent bg-accent-wash" : "border-border hover:border-accent"
      )}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-inset text-accent">
        <Scissors size={18} />
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold text-text">{title}</span>
          {selected && <Badge variant="accent">Selecionado</Badge>}
        </div>
        <div className="text-caption text-text-muted">{subtitle}</div>
      </div>
      <div className="text-body font-bold text-accent tabular">{price}</div>
    </button>
  );
}

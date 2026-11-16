import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS as PLANS_UI, PLAN_TABLE } from "@/features/landing/content";

// Mesma tabela da landing (fonte única): só o que existe de verdade, por plano.
// Ver barber-agencia-base/references/planos-e-precos.md e provas.md.
const POPULAR_BADGE = "Mais popular";

export default function PlanosSaasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 uppercase text-text">Planos da plataforma</h1>
        <p className="text-caption text-text-2">
          Sem adesão · cancelamento livre.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {PLANS_UI.map((pl) => (
          <div
            key={pl.name}
            className={cn(
              "relative flex flex-col gap-3.5 rounded-lg bg-surface p-6 transition-shadow hover:shadow-sm",
              pl.highlight ? "border-2 border-accent" : "border border-border"
            )}
          >
            {pl.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-accent px-3.5 py-1 text-[11px] font-bold text-text-inverse">
                {POPULAR_BADGE}
              </span>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-[26px] font-extrabold uppercase leading-none text-text">
                {pl.name}
              </div>
              {pl.discountBadge && (
                <span className="whitespace-nowrap rounded-md bg-accent px-2.5 py-1 font-display text-[18px] font-black leading-none text-text-inverse">
                  {pl.discountBadge}
                </span>
              )}
            </div>
            <div>
              {pl.fullPrice && (
                <div className="text-body font-semibold text-text-muted line-through">{pl.fullPrice}</div>
              )}
              <div className="font-display text-[34px] font-black leading-none text-accent">
                {pl.price}
              </div>
              <div className="mt-1 text-caption text-text-muted">{pl.cycle}</div>
            </div>
            <p className="text-caption text-text-2">{pl.desc}</p>
            <div className="h-px bg-border-subtle" />
            <div className="flex flex-1 flex-col gap-2.5">
              {pl.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 text-caption leading-snug">
                  {f.ok ? (
                    <Check size={16} className="mt-px shrink-0 text-success-strong" />
                  ) : (
                    <X size={16} className="mt-px shrink-0 text-text-muted" />
                  )}
                  <span className={f.ok ? "text-text" : "text-text-muted"}>{f.text}</span>
                </div>
              ))}
            </div>
            <button
              className={cn(
                "rounded-md py-3 text-body font-bold transition-opacity hover:opacity-90",
                pl.highlight ? "bg-accent text-text-inverse" : "border border-accent text-accent"
              )}
            >
              Começar agora
            </button>
          </div>
        ))}
      </div>

      {/* Comparativo */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b border-border px-5 py-3 text-overline uppercase text-text-muted">
              <span>Comparativo</span>
              <span>Personal</span>
              <span className="text-accent">Essencial</span>
              <span>Advance</span>
            </div>
            {PLAN_TABLE.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 border-b border-border-subtle px-5 py-3 text-body transition-colors last:border-b-0 hover:bg-accent-wash"
              >
                <span className="font-medium text-text">{row.label}</span>
                <span className="text-text-2">{row.a}</span>
                <span className="font-semibold text-accent">{row.b}</span>
                <span className="text-text-2">{row.c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-caption text-text-muted">
        * Promoção de fim de ano: Personal R$ 69,90/mês nos 2 primeiros meses, depois R$ 129,90/mês. Essencial R$ 89,90/mês
        nos 2 primeiros meses, depois R$ 189,90/mês. Advance sem promoção. Sem custo de adesão, setup ou migração.
      </p>
    </div>
  );
}

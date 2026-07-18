import { CutMeter } from "@/components/cut-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { CURRENT_CLIENT } from "@/features/client/mock-data";

export default function MeuPlanoPage() {
  const c = CURRENT_CLIENT;
  const history = [
    { label: "Corte + barba", date: "07 Set" },
    { label: "Corte", date: "24 Ago" },
    { label: "Corte + sobrancelha", date: "10 Ago" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meu plano</h1>

      <div className="rounded-lg border-2 border-accent bg-surface p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-h4 font-semibold text-text">{c.plan.name}</div>
            <div className="text-caption text-text-muted">{c.plan.scope}</div>
          </div>
          <Badge variant="success">Ativa</Badge>
        </div>
        <div className="flex items-center gap-5">
          <CutMeter remaining={c.cutsRemaining} total={c.cutsTotal} size={110} />
          <div className="flex flex-col gap-1 tabular">
            <div className="text-h3 text-accent">{formatBRL(c.plan.priceBRL)}/mês</div>
            <div className="text-caption text-text-muted">Cobrança recorrente · todo dia {c.billingDay}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" size="sm">Trocar plano</Button>
          <Button variant="ghost" size="sm">Cancelar assinatura</Button>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Histórico de uso</div>
        {history.map((h, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3"
          >
            <span className="text-body text-text">{h.label}</span>
            <span className="text-caption text-text-muted tabular">{h.date}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

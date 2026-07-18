import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { CURRENT_CLIENT } from "@/features/client/mock-data";

export default function RevisaoPage() {
  const c = CURRENT_CLIENT;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Revisão da inscrição</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <Row label="Cliente" value={c.name} />
        <Row label="Plano" value={c.plan.name} />
        <Row label="Escopo" value={c.plan.scope} />
        <Row label="Cobrança" value={`Mensal recorrente · todo dia ${c.billingDay}`} />
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <span className="text-body-lg font-semibold text-text">Total</span>
          <span className="text-h3 text-accent tabular">{formatBRL(c.plan.priceBRL)}/mês</span>
        </div>
      </div>

      <Link href="/pagamento">
        <Button size="lg" className="w-full">
          Ir para pagamento
        </Button>
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-caption uppercase text-text-muted">{label}</span>
      <span className="text-body text-text">{value}</span>
    </div>
  );
}

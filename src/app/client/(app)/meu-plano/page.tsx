import Link from "next/link";
import { Check } from "lucide-react";
import { CutMeter } from "@/components/cut-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { planBenefits } from "@/lib/plan";
import { MeuPlanoActions } from "@/features/client/components/meu-plano-actions";
import { getMyPlan, getCatalog } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function MeuPlanoPage() {
  const [data, catalog] = await Promise.all([getMyPlan(), getCatalog()]);
  const combos = catalog.combos as { id: string; name: string; cuts: number; price_brl: number }[];
  const sub = data?.sub as
    | { saldo_cortes: number; billing_day: number; combo_plans: unknown }
    | null
    | undefined;
  const combo = one(sub?.combo_plans as { name: string; cuts: number; scope: string; price_brl: number }[] | { name: string; cuts: number; scope: string; price_brl: number });
  const request = data?.request as { type: "CHANGE" | "CANCEL"; combo_plans: unknown } | null | undefined;
  const reqCombo = one(request?.combo_plans as { name: string }[] | { name: string });
  const pendingMsg = request
    ? request.type === "CANCEL"
      ? "Cancelamento solicitado — aguardando confirmação da barbearia."
      : `Troca para "${reqCombo?.name ?? "novo plano"}" solicitada — aguardando confirmação da barbearia.`
    : null;

  if (!sub || !combo) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h3 font-bold text-text">Meu plano</h1>
        {request ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-warning bg-warning-bg p-8 text-center">
            <p className="text-body text-warning-strong">
              ⏳ Assinatura do{" "}
              <strong>{reqCombo?.name ?? "plano"}</strong> solicitada — aguardando a confirmação da barbearia.
              Você recebe a confirmação no WhatsApp.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-body text-text-2">Você ainda não tem um plano ativo.</p>
            <Link href="/client/servicos">
              <Button>Ver planos</Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meu plano</h1>

      {pendingMsg && (
        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-caption text-warning-strong">
          ⏳ {pendingMsg}
        </div>
      )}

      <div className="rounded-lg border-2 border-accent bg-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-h4 font-semibold text-text">{combo.name}</div>
            <ul className="mt-2 flex flex-col gap-1">
              {planBenefits(combo.cuts, combo.scope).map((b, i) => (
                <li key={i} className="flex items-start gap-1.5 text-caption text-text-2">
                  <Check size={13} className="mt-0.5 flex-shrink-0 text-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <Badge variant="success">Assinatura ativa</Badge>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          <CutMeter remaining={sub.saldo_cortes} total={combo.cuts} size={110} />
          <div className="flex flex-col gap-1 text-center tabular sm:text-left">
            <div className="text-h4 text-accent sm:text-h3">{formatBRL(combo.price_brl)}/mês</div>
            <div className="text-caption text-text-muted">Renova todo dia {sub.billing_day}</div>
          </div>
        </div>
        <MeuPlanoActions combos={combos} currentComboName={combo.name} hasPending={!!request} />
      </div>
    </div>
  );
}

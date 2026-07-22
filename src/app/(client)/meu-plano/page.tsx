import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CutMeter } from "@/components/cut-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-2">Você ainda não tem um plano ativo.</p>
          <Link href="/servicos">
            <Button>Ver planos</Button>
          </Link>
        </div>
      </div>
    );
  }

  const usage = (data?.usage ?? []) as { id: string; start_at: string; services: unknown; combo_plans: unknown }[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meu plano</h1>

      {pendingMsg && (
        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-caption text-warning-strong">
          ⏳ {pendingMsg}
        </div>
      )}

      <div className="rounded-lg border-2 border-accent bg-surface p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-h4 font-semibold text-text">{combo.name}</div>
            <div className="text-caption text-text-muted">{combo.scope}</div>
          </div>
          <Badge variant="success">Assinatura ativa</Badge>
        </div>
        <div className="flex items-center gap-5">
          <CutMeter remaining={sub.saldo_cortes} total={combo.cuts} size={110} />
          <div className="flex flex-col gap-1 tabular">
            <div className="text-h3 text-accent">{formatBRL(combo.price_brl)}/mês</div>
            <div className="text-caption text-text-muted">Renova todo dia {sub.billing_day}</div>
          </div>
        </div>
        <MeuPlanoActions combos={combos} currentComboName={combo.name} hasPending={!!request} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Histórico de uso</div>
        {usage.length === 0 && <p className="text-caption text-text-muted">Nenhum uso ainda.</p>}
        {usage.map((u) => {
          const svc = one(u.services as { name: string }[] | { name: string }) ?? one(u.combo_plans as { name: string }[] | { name: string });
          return (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3"
            >
              <span className="text-body text-text">{svc?.name ?? "Corte"}</span>
              <span className="text-caption text-text-muted tabular">
                {format(new Date(u.start_at), "dd MMM · HH:mm", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

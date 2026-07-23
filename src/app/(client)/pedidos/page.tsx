import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, Scissors, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, type AppointmentStatus } from "@/components/status-badge";
import { ServiceTimer } from "@/components/service-timer";
import { formatBRL } from "@/lib/utils";
import { getMyActiveComanda } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Item {
  id: string;
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
  duration_min: number;
}

export default async function PedidosPage() {
  const comanda = (await getMyActiveComanda()) as
    | {
        id: string;
        start_at: string;
        status: string;
        service_started_at: string | null;
        service_ended_at: string | null;
        barbers: unknown;
        appointment_items: Item[] | null;
      }
    | null;

  if (!comanda) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h3 font-bold text-text">Meu pedido</h1>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent">
            <Receipt size={26} />
          </span>
          <p className="text-body text-text-2">Você não tem um pedido em aberto.</p>
          <Link href="/servicos">
            <Button>Agendar</Button>
          </Link>
        </div>
      </div>
    );
  }

  const items = comanda.appointment_items ?? [];
  const total = items.reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);
  const barber = one(comanda.barbers as { name: string }[] | { name: string });
  const inService = !!comanda.service_started_at && comanda.status !== "DONE";
  const estimate = items.reduce((s, i) => s + (i.kind === "service" ? i.duration_min * i.qty : 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h3 font-bold text-text">Meu pedido</h1>

      <div className="flex flex-col gap-4 rounded-lg border-2 border-accent bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-body font-semibold text-text tabular">
              {format(new Date(comanda.start_at), "EEE, dd MMM · HH:mm", { locale: ptBR })}
            </div>
            {barber && <div className="text-caption text-text-muted">com {barber.name}</div>}
          </div>
          {inService ? (
            <Badge variant="accent">Em atendimento</Badge>
          ) : (
            <StatusBadge status={comanda.status as AppointmentStatus} />
          )}
        </div>

        {inService && (
          <div className="rounded-md border border-accent bg-accent-wash p-3">
            <ServiceTimer startedAt={comanda.service_started_at!} estimateMin={estimate} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-body text-text-2">
                {it.kind === "service" ? <Scissors size={14} className="text-accent" /> : <Package size={14} className="text-accent" />}
                {it.qty > 1 ? `${it.qty}x ` : ""}
                {it.name}
              </span>
              {it.covered_by_plan ? (
                <span className="text-caption font-semibold text-accent">Plano · incluído</span>
              ) : (
                <span className="text-body tabular text-text">{formatBRL(Number(it.price_brl) * it.qty)}</span>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border-subtle pt-2">
            <span className="text-body font-semibold text-text">Total no local</span>
            <span className="text-h4 font-bold text-accent tabular">{formatBRL(total)}</span>
          </div>
          <p className="text-caption text-text-muted">O pagamento é feito no local após o atendimento.</p>
        </div>
      </div>
    </div>
  );
}

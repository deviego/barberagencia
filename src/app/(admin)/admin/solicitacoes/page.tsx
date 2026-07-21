import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { RequestCard, type RequestRow } from "@/features/admin/components/request-card";
import { listRequests, getRecentCancellations } from "@/features/admin/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function SolicitacoesPage() {
  const [requests, cancellations] = await Promise.all([
    listRequests() as unknown as Promise<RequestRow[]>,
    getRecentCancellations(),
  ]);
  const cancels = cancellations as {
    id: string;
    start_at: string;
    consumed_from_plan: boolean;
    clients: unknown;
    services: unknown;
    combo_plans: unknown;
  }[];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h3 font-bold text-text">Solicitações de agendamento</h1>
        <p className="text-body text-text-2">
          Confirme em até 10 minutos ou libere o horário. Sem resposta, o horário é liberado.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-muted">
          Nenhuma solicitação pendente.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((r) => (
            <RequestCard key={r.id} req={r} />
          ))}
        </div>
      )}

      {/* Cancelamentos recentes */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div>
          <div className="text-overline uppercase text-text-muted">Cancelamentos recentes</div>
          <p className="text-caption text-text-muted">
            Cancelamento de assinante devolve o corte ao saldo automaticamente. Pagamento é no local (sem estorno online).
          </p>
        </div>
        {cancels.length === 0 && <p className="text-caption text-text-muted">Nenhum cancelamento recente.</p>}
        {cancels.map((c) => {
          const client = one(c.clients as { name: string }[] | { name: string });
          const svc = one(c.services as { name: string }[] | { name: string }) ?? one(c.combo_plans as { name: string }[] | { name: string });
          return (
            <div key={c.id} className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-3">
              <div>
                <div className="text-body font-semibold text-text">{client?.name ?? "Cliente"}</div>
                <div className="text-caption text-text-muted">
                  {svc?.name ?? "Serviço"} · {format(new Date(c.start_at), "dd MMM · HH:mm", { locale: ptBR })}
                </div>
              </div>
              {c.consumed_from_plan ? (
                <Badge variant="success">Corte devolvido</Badge>
              ) : (
                <Badge variant="neutral">Avulso</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

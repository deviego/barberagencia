import { RequestCard, type RequestRow } from "@/features/admin/components/request-card";
import { RefundsPanel } from "@/features/admin/components/refunds-panel";
import { listRequests } from "@/features/admin/data";

export default async function SolicitacoesPage() {
  const requests = (await listRequests()) as unknown as RequestRow[];

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

      <RefundsPanel />
    </div>
  );
}

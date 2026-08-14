import { getCurrentTenant } from "@/lib/tenant/resolve";
import { FilaView } from "@/features/queue/components/fila-view";
import {
  getMyTicket,
  getQueueBoard,
  getQueueServices,
  getQueueBarbers,
  getQueueConfig,
} from "@/features/queue/data";

export const dynamic = "force-dynamic";

export default async function ClientFilaPage() {
  const tenant = await getCurrentTenant();
  const config = await getQueueConfig(tenant.id);

  if (!config.enabled) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-h4 font-bold text-text">Fila indisponível</h1>
        <p className="mt-2 text-body text-text-2">Esta barbearia ainda não ativou a fila de atendimento.</p>
      </div>
    );
  }

  if (config.mode === "TOTEM") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-h4 font-bold text-text">Fila pelo totem</h1>
        <p className="mt-2 text-body text-text-2">
          Nesta barbearia, a senha é retirada no totem do balcão. É só chegar e pegar a sua senha por lá.
        </p>
      </div>
    );
  }

  const [ticket, board, services, barbers] = await Promise.all([
    getMyTicket(),
    getQueueBoard(tenant.id),
    getQueueServices(tenant.id),
    config.pickBarber ? getQueueBarbers(tenant.id) : Promise.resolve([]),
  ]);

  return (
    <div className="py-6">
      <h1 className="mb-6 text-center text-h4 font-bold text-text">{tenant.name}</h1>
      <FilaView
        tenantId={tenant.id}
        ticket={ticket}
        serving={board.serving}
        services={services}
        barbers={barbers}
        pickBarber={config.pickBarber}
      />
    </div>
  );
}

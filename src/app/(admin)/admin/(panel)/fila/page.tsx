import QRCode from "qrcode";
import { getRequestOrigin } from "@/lib/http";
import { Badge } from "@/components/ui/badge";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getEffectivePlan } from "@/lib/plan/effective";
import { hasEntitlement, minPlanForFeature } from "@/lib/entitlements";
import { LockedFeature } from "@/features/plan/components/locked-feature";
import { AdminFila } from "@/features/queue/components/admin-fila";
import { TotemAccess } from "@/features/queue/components/totem-access";
import { QueueHistory } from "@/features/queue/components/queue-history";
import { getAdminQueue, getQueueConfig, getQueueHistory, getTotemToken } from "@/features/queue/data";

export const dynamic = "force-dynamic";

export default async function AdminFilaPage() {
  const [tenant, eff] = await Promise.all([getCurrentTenant(), getEffectivePlan()]);

  // Gate por plano (recurso "queue"): fora do teste, exige o plano.
  if (eff.gated && !hasEntitlement(eff.plan, "queue")) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-h3 font-bold text-text">Fila</h1>
        <LockedFeature
          title="Fila de atendimento"
          description="Receba os clientes por ordem de chegada com senha via QR no totem."
          currentPlan={eff.plan}
          needPlan={minPlanForFeature("queue")}
        />
      </div>
    );
  }

  const config = await getQueueConfig(tenant.id);

  if (!config.enabled) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-h3 font-bold text-text">Fila</h1>
        <div className="rounded-lg border border-warning-strong/30 bg-warning-bg/40 p-5">
          <p className="text-body text-warning-strong">
            A fila ainda não está ativada para esta barbearia. Fale com o suporte para habilitar.
          </p>
        </div>
      </div>
    );
  }

  const origin = await getRequestOrigin();
  const token = await getTotemToken(tenant.id);
  const totemOn = config.mode === "TOTEM" || config.mode === "BOTH";
  const appOn = config.mode === "APP" || config.mode === "BOTH";

  const totemUrl = token ? `${origin}/b/${tenant.subdomain}/totem?k=${token}` : null;
  const filaUrl = `${origin}/b/${tenant.subdomain}/fila`;
  const painelUrl = `${origin}/b/${tenant.subdomain}/painel`;

  // QRs independentes: o do totem (kiosk, aberto no aparelho) e o da fila do
  // cliente (o cliente escaneia, tira a senha e acompanha pelo próprio celular).
  const [items, history, totemQr, filaQr] = await Promise.all([
    getAdminQueue(),
    getQueueHistory(),
    totemOn && totemUrl ? QRCode.toDataURL(totemUrl, { margin: 1, width: 240 }) : Promise.resolve(null),
    appOn ? QRCode.toDataURL(filaUrl, { margin: 1, width: 240 }) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="text-h3 font-bold text-text">Fila</h1>
        <Badge variant="neutral">{items.length}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3">
          <AdminFila items={items} />
        </section>

        <TotemAccess
          totemUrl={totemUrl}
          totemQr={totemQr}
          totemOn={totemOn && !!totemUrl}
          filaUrl={filaUrl}
          filaQr={filaQr}
          appOn={appOn}
          painelUrl={painelUrl}
        />
      </div>

      <QueueHistory data={history} />
    </div>
  );
}

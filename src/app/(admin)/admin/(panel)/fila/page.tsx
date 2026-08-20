import QRCode from "qrcode";
import { headers } from "next/headers";
import { ExternalLink, MonitorSmartphone, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getEffectivePlan } from "@/lib/plan/effective";
import { hasEntitlement, minPlanForFeature } from "@/lib/entitlements";
import { LockedFeature } from "@/features/plan/components/locked-feature";
import { AdminFila } from "@/features/queue/components/admin-fila";
import { getAdminQueue, getQueueConfig, getTotemToken } from "@/features/queue/data";

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

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const token = await getTotemToken(tenant.id);
  const totemOn = config.mode === "TOTEM" || config.mode === "BOTH";
  const appOn = config.mode === "APP" || config.mode === "BOTH";

  const totemUrl = token ? `${proto}://${host}/b/${tenant.subdomain}/totem?k=${token}` : null;
  const filaUrl = `${proto}://${host}/b/${tenant.subdomain}/fila`;
  const painelUrl = `${proto}://${host}/b/${tenant.subdomain}/painel`;

  // QR: no modo totem, aponta para o kiosk (abrir no iPad); no app, para a fila do cliente.
  const qrTarget = totemOn && totemUrl ? totemUrl : filaUrl;
  const [items, qrDataUrl] = await Promise.all([getAdminQueue(), QRCode.toDataURL(qrTarget, { margin: 1, width: 240 })]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-h3 font-bold text-text">Fila</h1>
          <Badge variant="neutral">{items.length}</Badge>
        </div>
        {/* Acesso rápido — abrir totem e painel com um toque */}
        <div className="flex flex-wrap gap-2">
          {totemOn && totemUrl && (
            <a href={totemUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <MonitorSmartphone size={15} /> Abrir totem
              </Button>
            </a>
          )}
          <a href={painelUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Tv size={15} /> Abrir painel de chamada
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <section className="flex flex-col gap-3">
          <AdminFila items={items} />
        </section>

        {/* QR — abrir no iPad (totem) ou escanear pelo cliente (app) */}
        <aside className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-5 text-center">
          <div className="text-overline uppercase text-text-muted">{totemOn ? "Abrir o totem no iPad" : "QR da fila (cliente)"}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR da fila" className="h-44 w-44 rounded-md border border-border" />
          <p className="text-caption text-text-2">
            {totemOn ? "Escaneie com o iPad para abrir o totem em tela cheia." : "O cliente escaneia e entra na fila pelo celular."}
          </p>
          <a href={qrTarget} target="_blank" rel="noopener noreferrer" className="break-all text-caption text-accent hover:underline">
            {qrTarget}
          </a>
          <a
            href={painelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline"
          >
            Abrir painel de chamada (TV) <ExternalLink size={13} />
          </a>
        </aside>
      </div>
    </div>
  );
}

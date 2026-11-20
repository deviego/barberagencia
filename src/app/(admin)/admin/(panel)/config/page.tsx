import { Badge } from "@/components/ui/badge";
import { BrandingForm } from "@/features/admin/components/branding-form";
import { LogoUpload } from "@/features/admin/components/logo-upload";
import { UnitSettingsForm } from "@/features/admin/components/unit-settings-form";
import { WhatsAppConnect } from "@/features/admin/components/whatsapp-connect";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getBranding, getUnitSettings } from "@/features/admin/data";
import { getTenantContract } from "@/features/contract/data";
import { buildContractView, contractToData } from "@/features/contract/view";
import { ContractSection } from "@/features/contract/components/contract-section";
import { getEffectivePlan, getPlanUsage } from "@/lib/plan/effective";
import { hasEntitlement, minPlanForFeature } from "@/lib/entitlements";
import { PlanUsage } from "@/features/plan/components/plan-usage";
import QRCode from "qrcode";
import { getRequestOrigin } from "@/lib/http";
import { getQueueConfig, getTotemToken } from "@/features/queue/data";
import { PickBarberToggle } from "@/features/queue/components/pick-barber-toggle";
import { TotemConfig } from "@/features/queue/components/totem-config";
import { TotemTablet } from "@/features/queue/components/totem-tablet";
import { QuickQueueToggle } from "@/features/quick-queue/components/quick-queue-toggle";
import { LockedFeature } from "@/features/plan/components/locked-feature";
import { waStatus } from "@/features/admin/whatsapp-actions";
import { ClientQr } from "@/features/admin/components/client-qr";
import { ConfigTabs } from "@/features/admin/components/config-tabs";
import {
  quickQueueLimitAlert,
  quickQueueOnFor,
  showQueuePoster,
  showQueuePosterHint,
} from "@/features/admin/components/qr-posters/visibility";
import { getQuickQueueLimitSummary } from "@/features/quick-queue/admin-data";
import { QUICK_QUEUE_ALERT_MIN_TOTAL } from "@/features/quick-queue/limits";
import { loadQuickQueueTenantState } from "@/features/quick-queue/data";

export default async function ConfigPage() {
  const [tenant, branding, unit, contract, planUsage, eff] = await Promise.all([
    getCurrentTenant(),
    getBranding(),
    getUnitSettings(),
    getTenantContract(),
    getPlanUsage(),
    getEffectivePlan(),
  ]);
  const contractView = buildContractView(contract);
  const queueCfg = await getQueueConfig(tenant.id);

  const origin = await getRequestOrigin();

  // Cartazes de QR (#127). Só links do cliente, montados com a origem + o slug desta barbearia:
  // B (Cadastro) leva a /b/<slug>; A (Fila digital) leva a /b/<slug>/fila. Nunca o link do totem.
  const publicUrl = `${origin}/b/${tenant.subdomain}`;
  // A: só com plano com "queue" (ou em teste) + fila ligada + fila rápida ligada nesta barbearia
  // (regra em showQueuePoster). A chave vem da mesma leitura do #123, que falha fechado: sem a
  // coluna da schema-51, com erro ou com outra barbearia no estado, vale false e o cartaz A some.
  const queueInPlan = !eff.gated || hasEntitlement(eff.plan, "queue");
  let quickQueueEnabled = false;
  try {
    quickQueueEnabled = quickQueueOnFor(await loadQuickQueueTenantState(tenant.subdomain), tenant.id);
  } catch {
    quickQueueEnabled = false;
  }
  const posterGate = {
    planHasQueue: queueInPlan,
    queueEnabled: queueCfg.enabled,
    quickQueueEnabled,
    queueMode: queueCfg.mode,
  };
  const queueUrl = showQueuePoster(posterGate) ? `${publicUrl}/fila` : null;
  // Fila no plano e ligada, fila rápida desligada: só o cartaz B + o aviso do cartaz da fila (#102).
  const queuePosterHint = showQueuePosterHint(posterGate);
  // Logo embutida como data URL (evita canvas "tainted" ao exportar o PNG).
  const logoUrl = branding?.logo_url ?? tenant.branding.logoUrl ?? null;
  let logoData: string | null = null;
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "image/png";
        const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
        logoData = `data:${ct};base64,${b64}`;
      }
    } catch {
      logoData = null;
    }
  }

  // Liga/desliga da fila rápida (#102): só com a fila no plano e ligada.
  const showQuickQueueToggle = queueInPlan && queueCfg.enabled;
  // Aviso de WhatsApp desconectado só quando o gateway respondeu; sem resposta, sem aviso.
  let whatsappDisconnected = false;
  if (showQuickQueueToggle) {
    try {
      const wa = await waStatus();
      whatsappDisconnected = wa.ok && wa.status !== "connected";
    } catch {
      whatsappDisconnected = false;
    }
  }

  // Alerta ao dono (#145): resumo do dia só com a fila rápida ligada; erro de leitura = sem alerta.
  let limitAlert: { kind: "CAP" | "HIGH"; total: number } | null = null;
  if (showQuickQueueToggle && quickQueueEnabled) {
    try {
      const summary = await getQuickQueueLimitSummary(tenant.id);
      const kind = quickQueueLimitAlert(summary, quickQueueEnabled, QUICK_QUEUE_ALERT_MIN_TOTAL);
      if (kind && summary) limitAlert = { kind, total: summary.total };
    } catch {
      limitAlert = null;
    }
  }

  // Link + QR do totem: só com a fila ligada e o modo Totem ou Ambos (bloco "Totem — só no tablet").
  let totem: { url: string; qr: string } | null = null;
  if (queueCfg.enabled && (queueCfg.mode === "TOTEM" || queueCfg.mode === "BOTH")) {
    const token = await getTotemToken(tenant.id);
    if (token) {
      const url = `${origin}/b/${tenant.subdomain}/totem?k=${token}`;
      totem = { url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Configurações & Branding</h1>

      <ConfigTabs
        panels={{
          unidade: (
            /* Dados da unidade + horários (salvam de verdade) */
            <section className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="unidade">
              <div className="text-overline uppercase text-text-muted">Dados da unidade</div>
              <UnitSettingsForm tenantName={tenant.name} initial={unit} />
            </section>
          ),
          marca: (
            /* White-label */
            <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center gap-2">
                <div className="text-overline uppercase text-text-muted">White-label</div>
                <Badge variant="accent">Marca</Badge>
              </div>

              <LogoUpload
                current={branding?.logo_url ?? tenant.branding.logoUrl ?? null}
                logoText={tenant.branding.logoText}
              />

              <BrandingForm
                initialAccent={branding?.accent ?? "#C9A24B"}
                initialInstagram={branding?.instagram ?? tenant.branding.instagram ?? ""}
              />
            </section>
          ),
          "qr-fila": (
            <>
              {showQuickQueueToggle ? (
                <QuickQueueToggle
                  enabled={quickQueueEnabled}
                  whatsappDisconnected={whatsappDisconnected}
                  alert={limitAlert}
                />
              ) : (
                !queueInPlan && (
                  <LockedFeature
                    title="Fila de atendimento"
                    description="Receba os clientes por ordem de chegada com senha via QR no totem."
                    currentPlan={eff.plan}
                    needPlan={minPlanForFeature("queue")}
                  />
                )
              )}

              <ClientQr
                publicUrl={publicUrl}
                queueUrl={queueUrl}
                queuePosterHint={queuePosterHint}
                // O cartaz A só aparece com a fila rápida ligada (showQueuePoster): passo 2 = telefone.
                queueEntry={quickQueueEnabled ? "PHONE" : "LOGIN"}
                slug={tenant.subdomain}
                logoDataUrl={logoData}
                logoText={tenant.branding.logoText}
                name={tenant.name}
                accent={branding?.accent ?? tenant.branding.accent ?? null}
              />

              {totem && <TotemTablet totemUrl={totem.url} qrDataUrl={totem.qr} />}

              {queueCfg.enabled && (
                <TotemConfig mode={queueCfg.mode} planRequiresService={queueCfg.planRequiresService} />
              )}

              {queueCfg.enabled && <PickBarberToggle enabled={queueCfg.pickBarber} />}
            </>
          ),
          whatsapp: <WhatsAppConnect />,
          "plano-contrato": (
            <>
              <PlanUsage view={planUsage} />

              {contractView && (
                <ContractSection
                  view={contractView}
                  initial={{ ...contractToData(contract), tradeName: contract?.trade_name ?? tenant.name }}
                />
              )}
            </>
          ),
        }}
      />
    </div>
  );
}

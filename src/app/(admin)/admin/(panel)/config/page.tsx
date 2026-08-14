import { Badge } from "@/components/ui/badge";
import { BrandingForm } from "@/features/admin/components/branding-form";
import { LogoUpload } from "@/features/admin/components/logo-upload";
import { UnitSettingsForm } from "@/features/admin/components/unit-settings-form";
import { WhatsAppConnect } from "@/features/admin/components/whatsapp-connect";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getBranding, getUnitSettings } from "@/features/admin/data";
import { getTenantContract } from "@/features/contract/data";
import { buildContractView } from "@/features/contract/view";
import { ContractSection } from "@/features/contract/components/contract-section";
import { getPlanUsage } from "@/lib/plan/effective";
import { PlanUsage } from "@/features/plan/components/plan-usage";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { getQueueConfig, getTotemToken } from "@/features/queue/data";
import { PickBarberToggle } from "@/features/queue/components/pick-barber-toggle";
import { TotemConfig } from "@/features/queue/components/totem-config";

export default async function ConfigPage() {
  const [tenant, branding, unit, contract, planUsage] = await Promise.all([
    getCurrentTenant(),
    getBranding(),
    getUnitSettings(),
    getTenantContract(),
    getPlanUsage(),
  ]);
  const contractView = buildContractView(contract);
  const queueCfg = await getQueueConfig(tenant.id);

  // Link + QR do totem (quando a fila está ativa).
  let totem: { url: string; qr: string } | null = null;
  if (queueCfg.enabled) {
    const token = await getTotemToken(tenant.id);
    if (token) {
      const h = await headers();
      const host = h.get("host") ?? "";
      const proto = host.includes("localhost") ? "http" : "https";
      const url = `${proto}://${host}/b/${tenant.subdomain}/totem?k=${token}`;
      totem = { url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
    }
  }

  return (
    <div className="flex flex-col gap-6" id="unidade">
      <h1 className="text-h3 font-bold text-text">Configurações & Branding</h1>

      {/* Dados da unidade + horários (salvam de verdade) */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Dados da unidade</div>
        <UnitSettingsForm tenantName={tenant.name} initial={unit} />
      </section>

      {/* White-label */}
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

      <WhatsAppConnect />

      {queueCfg.enabled && totem && (
        <TotemConfig
          totemUrl={totem.url}
          qrDataUrl={totem.qr}
          mode={queueCfg.mode}
          planRequiresService={queueCfg.planRequiresService}
        />
      )}

      {queueCfg.enabled && <PickBarberToggle enabled={queueCfg.pickBarber} />}

      <PlanUsage view={planUsage} />

      {contractView && <ContractSection view={contractView} />}
    </div>
  );
}

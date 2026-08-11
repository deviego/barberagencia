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

export default async function ConfigPage() {
  const [tenant, branding, unit, contract, planUsage] = await Promise.all([
    getCurrentTenant(),
    getBranding(),
    getUnitSettings(),
    getTenantContract(),
    getPlanUsage(),
  ]);
  const contractView = buildContractView(contract);

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

      <PlanUsage view={planUsage} />

      {contractView && <ContractSection view={contractView} />}
    </div>
  );
}

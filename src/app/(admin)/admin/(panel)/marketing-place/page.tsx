import { MarketingPlaceTabs } from "@/features/admin/components/marketing-place-tabs";
import { MarketingSection } from "@/features/admin/components/marketing-section";
import { MensagensSection } from "@/features/admin/components/mensagens-section";
import { getEffectivePlan } from "@/lib/plan/effective";
import { hasEntitlement } from "@/lib/entitlements";

export default async function MarketingPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  // Mensagens (modelos via wa.me) vale para todos os planos (whatsapp.manual).
  // Só a aba de campanhas fica atrás de marketing.basic — o bloqueio é dentro dela.
  const eff = await getEffectivePlan();
  const campaignsLocked = eff.gated && !hasEntitlement(eff.plan, "marketing.basic");
  const active =
    tab === "mensagens" || tab === "marketing" ? tab : campaignsLocked ? "mensagens" : "marketing";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Marketing Place</h1>
      <MarketingPlaceTabs active={active} />
      {active === "mensagens" ? <MensagensSection /> : <MarketingSection />}
    </div>
  );
}

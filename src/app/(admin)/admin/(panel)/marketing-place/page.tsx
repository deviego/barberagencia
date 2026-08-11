import { MarketingPlaceTabs } from "@/features/admin/components/marketing-place-tabs";
import { MarketingSection } from "@/features/admin/components/marketing-section";
import { MensagensSection } from "@/features/admin/components/mensagens-section";
import { getEffectivePlan } from "@/lib/plan/effective";
import { hasEntitlement, minPlanForFeature } from "@/lib/entitlements";
import { LockedFeature } from "@/features/plan/components/locked-feature";

export default async function MarketingPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tab === "mensagens" ? "mensagens" : "marketing";

  const eff = await getEffectivePlan();
  const locked = eff.gated && !hasEntitlement(eff.plan, "marketing.basic");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Marketing Place</h1>
      {locked ? (
        <LockedFeature
          title="Campanhas de marketing"
          description="Crie campanhas e dispare mensagens para os seus clientes."
          currentPlan={eff.plan}
          needPlan={minPlanForFeature("marketing.basic")}
        />
      ) : (
        <>
          <MarketingPlaceTabs active={active} />
          {active === "mensagens" ? <MensagensSection /> : <MarketingSection />}
        </>
      )}
    </div>
  );
}

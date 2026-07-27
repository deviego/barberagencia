import { MarketingPlaceTabs } from "@/features/admin/components/marketing-place-tabs";
import { MarketingSection } from "@/features/admin/components/marketing-section";
import { MensagensSection } from "@/features/admin/components/mensagens-section";

export default async function MarketingPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tab === "mensagens" ? "mensagens" : "marketing";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Marketing Place</h1>
      <MarketingPlaceTabs active={active} />
      {active === "mensagens" ? <MensagensSection /> : <MarketingSection />}
    </div>
  );
}

import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getTenantContract } from "@/features/contract/data";
import { buildContractView, contractToData } from "@/features/contract/view";
import { ContractSection } from "@/features/contract/components/contract-section";
import { WhatsAppConnect } from "@/features/admin/components/whatsapp-connect";

export const dynamic = "force-dynamic";

export default async function DistributorConfigPage() {
  const [tenant, contract] = await Promise.all([getCurrentTenant(), getTenantContract()]);
  const contractView = buildContractView(contract);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Conta</h1>

      <WhatsAppConnect />

      {contractView && (
        <ContractSection
          view={contractView}
          initial={{ ...contractToData(contract), tradeName: contract?.trade_name ?? tenant.name }}
        />
      )}
    </div>
  );
}

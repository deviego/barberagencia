import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getTenantContract } from "@/features/contract/data";
import { buildContractView, contractToData } from "@/features/contract/view";
import { ContractSection } from "@/features/contract/components/contract-section";
import { WhatsAppConnect } from "@/features/admin/components/whatsapp-connect";
import { getDistributorAccess } from "@/features/distributor/guard";

export const dynamic = "force-dynamic";

export default async function DistributorConfigPage() {
  // O layout não é fronteira: a página também confere o acesso antes de buscar dados.
  if (!(await getDistributorAccess()).ok) return null;
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

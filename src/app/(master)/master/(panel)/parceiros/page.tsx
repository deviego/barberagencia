import { getPartners, listTenantsMini } from "@/features/partners/data";
import { PartnersManager } from "@/features/partners/components/partners-manager";
import { getRequestOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function ParceirosPage() {
  const [partners, tenants, origin] = await Promise.all([getPartners(), listTenantsMini(), getRequestOrigin()]);
  return <PartnersManager partners={partners} tenants={tenants} origin={origin} />;
}

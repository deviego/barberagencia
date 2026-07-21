import { ServicosView } from "@/features/client/components/servicos-view";
import { getCatalog } from "@/features/client/data";

export default async function ServicosPage() {
  const { services, combos } = await getCatalog();
  return <ServicosView services={services} combos={combos} />;
}

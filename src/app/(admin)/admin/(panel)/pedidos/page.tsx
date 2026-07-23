import { ComandaPanel } from "@/features/admin/components/comanda-panel";
import { getComandas, getServices, getProducts } from "@/features/admin/data";

export default async function PedidosPage() {
  const [comandas, services, products] = await Promise.all([getComandas(), getServices(), getProducts()]);
  const activeServices = (services as { id: string; name: string; price_brl: number; duration_min: number; active: boolean }[]).filter(
    (s) => s.active !== false
  );
  const activeProducts = (products as { id: string; name: string; price_brl: number; active: boolean }[]).filter(
    (p) => p.active !== false
  );

  return (
    <ComandaPanel
      comandas={comandas as never}
      services={activeServices}
      products={activeProducts}
    />
  );
}

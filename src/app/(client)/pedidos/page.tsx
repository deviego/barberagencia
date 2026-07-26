import { ClientPedidosList } from "@/features/client/components/client-pedidos-list";
import { getMyAppointments, getCatalog, getProducts } from "@/features/client/data";

interface Item {
  id: string;
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
  duration_min: number;
}
interface Order {
  id: string;
  start_at: string;
  status: string;
  service_started_at: string | null;
  barbers: unknown;
  services: unknown;
  combo_plans: unknown;
  appointment_items: Item[] | null;
}

export default async function PedidosPage() {
  const [orders, catalog, products] = await Promise.all([getMyAppointments(), getCatalog(), getProducts()]);

  return (
    <ClientPedidosList
      orders={orders as unknown as Order[]}
      services={catalog.services as { id: string; name: string; price_brl: number; duration_min?: number }[]}
      products={products as { id: string; name: string; price_brl: number }[]}
    />
  );
}

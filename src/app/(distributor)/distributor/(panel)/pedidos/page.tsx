import { getDistributorOrders } from "@/features/orders/data";
import { OrderCard } from "@/features/orders/components/order-card";

export const dynamic = "force-dynamic";

export default async function DistributorPedidosPage() {
  const orders = await getDistributorOrders();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Pedidos</h1>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body text-text-2">
          Nenhum pedido ainda. Quando uma barbearia da sua carteira fizer um pedido, ele aparece aqui.
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((o) => <OrderCard key={o.id} o={o} showActions />)}
        </div>
      )}
    </div>
  );
}

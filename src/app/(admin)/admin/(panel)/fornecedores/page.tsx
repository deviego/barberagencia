import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { getSuppliers, getMySupplierOrders } from "@/features/orders/data";
import { OrderCard } from "@/features/orders/components/order-card";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const [suppliers, orders] = await Promise.all([getSuppliers(), getMySupplierOrders()]);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h3 font-bold text-text">Fornecedores</h1>
        <p className="text-caption text-text-muted">Distribuidores que atendem sua barbearia. Faça pedidos online e acompanhe o status.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-body font-semibold text-text-2">Distribuidores</h2>
        {suppliers.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-body text-text-2">
            Nenhum distribuidor vinculou sua barbearia ainda. Peça ao seu distribuidor para adicionar sua barbearia à carteira dele.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {suppliers.map((s) => (
              <Link key={s.id} href={`/admin/fornecedores/${s.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition hover:border-accent">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-inset text-accent"><Truck size={18} /></span>
                  <span className="text-body font-semibold text-text">{s.name}</span>
                </div>
                <ChevronRight size={18} className="text-text-muted" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-body font-semibold text-text-2">Meus pedidos</h2>
        {orders.length === 0 ? (
          <p className="text-caption text-text-muted">Você ainda não fez nenhum pedido.</p>
        ) : (
          <div className="grid gap-4">
            {orders.map((o) => <OrderCard key={o.id} o={o} />)}
          </div>
        )}
      </section>
    </div>
  );
}

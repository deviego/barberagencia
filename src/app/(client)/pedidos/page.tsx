import Link from "next/link";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientComanda } from "@/features/client/components/client-comanda";
import { getMyActiveComanda, getCatalog, getProducts } from "@/features/client/data";

interface Item {
  id: string;
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
  duration_min: number;
}
interface Comanda {
  id: string;
  start_at: string;
  status: string;
  service_started_at: string | null;
  service_ended_at: string | null;
  barbers: unknown;
  appointment_items: Item[] | null;
}

export default async function PedidosPage() {
  const [comanda, catalog, products] = await Promise.all([getMyActiveComanda(), getCatalog(), getProducts()]);

  if (!comanda) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h3 font-bold text-text">Meu pedido</h1>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent">
            <Receipt size={26} />
          </span>
          <p className="text-body text-text-2">Você não tem um pedido em aberto.</p>
          <Link href="/servicos">
            <Button>Agendar</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ClientComanda
      comanda={comanda as unknown as Comanda}
      services={catalog.services as { id: string; name: string; price_brl: number; duration_min?: number }[]}
      products={products as { id: string; name: string; price_brl: number }[]}
    />
  );
}

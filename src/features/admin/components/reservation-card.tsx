"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { markReservationPickedUp, cancelReservation } from "@/features/admin/actions";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export interface ReservationRow {
  id: string;
  qty: number;
  created_at: string;
  clients: unknown;
  products: unknown;
}

export function ReservationCard({ res }: { res: ReservationRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const client = one(res.clients as { name: string }[] | { name: string });
  const product = one(res.products as { name: string; price_brl: number }[] | { name: string; price_brl: number });

  function act(fn: (id: string) => Promise<unknown>) {
    startTransition(async () => {
      await fn(res.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-inset text-accent">
            <Package size={16} />
          </span>
          <div>
            <div className="text-body font-semibold text-text">{client?.name ?? "Cliente"}</div>
            <div className="text-caption text-text-muted tabular">
              {format(new Date(res.created_at), "dd MMM · HH:mm", { locale: ptBR })}
            </div>
          </div>
        </div>
        <span className="text-body font-bold text-accent tabular">
          {product ? formatBRL(product.price_brl * res.qty) : ""}
        </span>
      </div>

      <p className="text-caption text-text-2">
        <strong>{res.qty}x</strong> {product?.name ?? "Produto"} — separar para retirada.
      </p>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" loading={pending} onClick={() => act(markReservationPickedUp)}>
          Marcar como entregue
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(cancelReservation)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

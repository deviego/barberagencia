import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import type { OrderView } from "../data";
import { OrderStatusActions } from "./order-status-actions";

export const ORDER_STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  PLACED: { label: "Recebido", variant: "warning" },
  CONFIRMED: { label: "Aceito", variant: "info" },
  SHIPPED: { label: "Enviado", variant: "accent" },
  DELIVERED: { label: "Entregue", variant: "success" },
  CANCELLED: { label: "Cancelado", variant: "neutral" },
};

/** Cartão de pedido, reutilizado no painel do distribuidor e no /admin da barbearia. */
export function OrderCard({ o, showActions }: { o: OrderView; showActions?: boolean }) {
  const s = ORDER_STATUS[o.status] ?? ORDER_STATUS.PLACED;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text">{o.counterpartName}</span>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>
        <div className="text-caption text-text-muted tabular">{new Date(o.createdAt).toLocaleString("pt-BR")}</div>
      </div>
      <div className="flex flex-col gap-1">
        {o.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between text-caption text-text-2">
            <span>{it.qty}× {it.name}</span>
            <span className="tabular">{formatBRL(it.priceBrl * it.qty)}</span>
          </div>
        ))}
      </div>
      {o.note && <div className="rounded-md bg-inset px-3 py-2 text-caption text-text-2">Obs.: {o.note}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <span className="text-body font-bold text-text tabular">Total: {formatBRL(o.totalBrl)}</span>
        {showActions && <OrderStatusActions orderId={o.id} status={o.status} />}
      </div>
    </div>
  );
}

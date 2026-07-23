"use client";

import { useState, useTransition } from "react";
import { Check, Minus, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { reserveProduct } from "@/features/client/actions";

interface Product { id: string; name: string; price_brl: number }

export function ProdutosView({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [reserved, setReserved] = useState(false);

  const total = products.reduce((s, p) => s + (cart[p.id] ?? 0) * p.price_brl, 0);
  const count = Object.values(cart).reduce((s, n) => s + n, 0);

  function setQty(id: string, qty: number) {
    setReserved(false);
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[id];
      else n[id] = qty;
      return n;
    });
  }

  function reserve() {
    const items = Object.entries(cart);
    if (!items.length) return;
    startTransition(async () => {
      for (const [id, qty] of items) {
        await reserveProduct(id, qty);
      }
      setCart({});
      setReserved(true);
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-h3 font-bold text-text">Produtos</h1>
        <p className="text-body text-text-2">Solicite e retire na sua próxima visita.</p>
      </div>

      {reserved && (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-4 py-3 text-caption text-success-strong">
          <Check size={16} /> Solicitação enviada! A barbearia vai separar para retirada.
        </div>
      )}

      {products.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-text-muted">
          Nenhum produto disponível no momento.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors",
                qty > 0 ? "border-2 border-accent" : "border-border"
              )}
            >
              <div className="flex h-16 items-center justify-center rounded-md bg-inset text-accent">
                <Package size={28} />
              </div>
              <div className="text-body font-semibold text-text">{p.name}</div>
              <div className="text-body font-bold text-accent tabular">{formatBRL(p.price_brl)}</div>

              {qty === 0 ? (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setQty(p.id, 1)}>
                  <Plus size={15} /> Solicitar
                </Button>
              ) : (
                <div className="flex items-center justify-between rounded-md border-2 border-accent px-1.5 py-1">
                  <button
                    onClick={() => setQty(p.id, qty - 1)}
                    aria-label="Diminuir"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-accent transition-colors hover:bg-accent-wash"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-body font-bold tabular text-text">{qty}</span>
                  <button
                    onClick={() => setQty(p.id, qty + 1)}
                    aria-label="Aumentar"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-accent transition-colors hover:bg-accent-wash"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-sticky border-t border-border bg-surface p-4 md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <div className="text-caption text-text-muted">{count} item(ns)</div>
              <div className="text-h4 font-bold text-accent tabular">{formatBRL(total)}</div>
            </div>
            <Button size="lg" loading={pending} onClick={reserve}>
              Solicitar retirada
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

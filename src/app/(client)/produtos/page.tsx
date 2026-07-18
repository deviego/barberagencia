"use client";

import { useState } from "react";
import { Check, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { CLIENT_PRODUCTS } from "@/features/client/mock-data";

export default function ProdutosPage() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const total = CLIENT_PRODUCTS.reduce((s, p) => s + (cart[p.id] ?? 0) * p.priceBRL, 0);
  const count = Object.values(cart).reduce((s, n) => s + n, 0);

  function toggle(id: string) {
    setCart((c) => {
      const next = { ...c };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-h3 font-bold text-text">Produtos</h1>
        <p className="text-body text-text-2">Reserve e retire na sua próxima visita.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CLIENT_PRODUCTS.map((p) => {
          const added = !!cart[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors",
                added ? "border-2 border-accent" : "border-border"
              )}
            >
              <div className="flex h-16 items-center justify-center rounded-md bg-inset text-accent">
                <Package size={28} />
              </div>
              <div className="text-body font-semibold text-text">{p.name}</div>
              <div className="text-body font-bold text-accent tabular">{formatBRL(p.priceBRL)}</div>
              <Button
                size="sm"
                variant={added ? "primary" : "outline"}
                className="w-full"
                onClick={() => toggle(p.id)}
              >
                {added ? (
                  <>
                    <Check size={15} /> Adicionado
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Adicionar
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Barra de total */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-sticky border-t border-border bg-surface p-4 md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <div className="text-caption text-text-muted">{count} item(ns)</div>
              <div className="text-h4 font-bold text-accent tabular">{formatBRL(total)}</div>
            </div>
            <Button size="lg">Reservar para retirada</Button>
          </div>
        </div>
      )}
    </div>
  );
}

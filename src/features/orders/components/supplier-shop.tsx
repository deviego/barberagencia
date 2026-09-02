"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import { placeOrder } from "../actions";
import type { CatalogProduct } from "../data";

export function SupplierShop({ distributorId, products }: { distributorId: string; products: CatalogProduct[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const set = (id: string, qty: number) => setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  const total = Object.entries(cart).reduce((a, [id, q]) => a + (byId.get(id)?.priceBrl ?? 0) * q, 0);
  const count = Object.values(cart).reduce((a, q) => a + q, 0);

  function submit() {
    setMsg(null);
    const items = Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));
    if (!items.length) return;
    startTransition(async () => {
      const res = await placeOrder(distributorId, items, note);
      if (res.ok) {
        setMsg({ ok: true, text: "Pedido enviado! O distribuidor vai confirmar." });
        setCart({});
        setNote("");
        router.refresh();
      } else setMsg({ ok: false, text: res.error ?? "Falha ao enviar." });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 && <p className="text-caption text-text-muted">Este distribuidor ainda não tem produtos disponíveis.</p>}
        {products.map((p) => {
          const qty = cart[p.id] ?? 0;
          const out = p.stock <= 0;
          return (
            <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-inset">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-caption text-text-muted">sem foto</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-body font-semibold text-text">{p.name}</div>
                <div className="text-caption text-text-muted">{out ? "Sem estoque" : `${p.stock} em estoque`}</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body font-bold text-accent tabular">{formatBRL(p.priceBrl)}</span>
                {out ? (
                  <span className="text-caption text-text-muted">indisponível</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => set(p.id, qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-2 hover:border-accent disabled:opacity-40" disabled={qty <= 0}><Minus size={14} /></button>
                    <span className="w-6 text-center text-body tabular">{qty}</span>
                    <button onClick={() => set(p.id, Math.min(qty + 1, p.stock))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-2 hover:border-accent disabled:opacity-40" disabled={qty >= p.stock}><Plus size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {count > 0 && (
        <div className="sticky bottom-4 flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4 shadow-lg">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação do pedido (opcional)" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-body font-bold text-text tabular">{count} item(s) · {formatBRL(total)}</span>
            <Button onClick={submit} loading={pending}><ShoppingCart size={16} /> Fazer pedido</Button>
          </div>
        </div>
      )}
      {msg && (
        <span className={`flex items-center gap-1 text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>
          {msg.ok && <Check size={13} />} {msg.text}
        </span>
      )}
    </div>
  );
}

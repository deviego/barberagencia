"use client";

import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { formatBRL, cn } from "@/lib/utils";
import { CLIENTS, PRODUCTS, SERVICES } from "@/features/admin/mock-data";

const METHODS = ["PIX", "Cartão", "Dinheiro", "Plano"] as const;

/** Botão + drawer de POS ("Lançar venda"). Autocontido; use no Dashboard e Financeiro. */
export function PosButton({ variant = "primary" }: { variant?: "primary" | "outline" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<(typeof METHODS)[number]>("PIX");
  const [done, setDone] = useState(false);

  const catalog = [
    ...SERVICES.map((s) => ({ id: `s:${s.id}`, name: s.name, priceBRL: s.priceBRL })),
    ...PRODUCTS.map((p) => ({ id: `p:${p.id}`, name: p.name, priceBRL: p.priceBRL })),
  ];
  const total = catalog.reduce((sum, i) => sum + (items[i.id] ?? 0) * i.priceBRL, 0);

  function toggle(id: string) {
    setItems((c) => {
      const n = { ...c };
      if (n[id]) delete n[id];
      else n[id] = 1;
      return n;
    });
  }

  function reset() {
    setItems({});
    setMethod("PIX");
    setDone(false);
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <ShoppingCart size={16} />
        Lançar venda
      </Button>

      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Lançar venda"
        footer={
          !done ? (
            <Button
              className="w-full"
              disabled={total === 0}
              onClick={() => setDone(true)}
            >
              Lançar venda · {formatBRL(total)}
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={reset}>
              Nova venda
            </Button>
          )
        }
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg">
              <Check size={26} className="text-success-strong" strokeWidth={3} />
            </span>
            <div className="text-h4 font-semibold text-text">Venda lançada</div>
            <div className="text-body text-text-2">{formatBRL(total)} · {method}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-text-2">Cliente</span>
              <select className="h-10 rounded-md border border-border bg-inset px-3 text-body text-text focus-visible:border-focus focus-visible:outline-none">
                <option>Venda de balcão</option>
                {CLIENTS.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <Section label="Serviços">
              {SERVICES.map((s) => (
                <ItemChip
                  key={s.id}
                  active={!!items[`s:${s.id}`]}
                  onClick={() => toggle(`s:${s.id}`)}
                  name={s.name}
                  price={s.priceBRL}
                />
              ))}
            </Section>

            <Section label="Produtos">
              {PRODUCTS.map((p) => (
                <ItemChip
                  key={p.id}
                  active={!!items[`p:${p.id}`]}
                  onClick={() => toggle(`p:${p.id}`)}
                  name={p.name}
                  price={p.priceBRL}
                />
              ))}
            </Section>

            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-text-2">Pagamento</span>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-md border py-2 text-caption transition-colors",
                      method === m
                        ? "border-2 border-accent bg-accent-wash text-accent"
                        : "border-border text-text-2 hover:border-accent"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ItemChip({
  active,
  onClick,
  name,
  price,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  price: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-caption transition-colors",
        active ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
      )}
    >
      {name} · {formatBRL(price)}
    </button>
  );
}

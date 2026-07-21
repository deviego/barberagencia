"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { formatBRL, cn } from "@/lib/utils";
import { createSale, type SaleItemInput } from "@/features/admin/actions";

interface Item { id: string; name: string; price_brl: number }
interface ClientOpt { id: string; name: string }

const METHODS: { label: string; value: string }[] = [
  { label: "PIX", value: "PIX" },
  { label: "Cartão", value: "CARD_CREDIT" },
  { label: "Dinheiro", value: "CASH" },
  { label: "Plano", value: "PLAN" },
];

export function PosButton({
  services,
  products,
  clients,
  variant = "primary",
}: {
  services: Item[];
  products: Item[];
  clients: ClientOpt[];
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [method, setMethod] = useState("PIX");
  const [picked, setPicked] = useState<Record<string, { kind: "service" | "product"; name: string; price: number }>>({});

  const total = Object.values(picked).reduce((s, i) => s + i.price, 0);

  function toggle(kind: "service" | "product", it: Item) {
    setPicked((p) => {
      const n = { ...p };
      if (n[it.id]) delete n[it.id];
      else n[it.id] = { kind, name: it.name, price: it.price_brl };
      return n;
    });
  }
  function reset() {
    setPicked({});
    setMethod("PIX");
    setClientId("");
    setDone(false);
    setError(null);
  }
  function submit() {
    setError(null);
    const items: SaleItemInput[] = Object.entries(picked).map(([id, v]) => ({
      kind: v.kind,
      refId: id,
      name: v.name,
      priceBRL: v.price,
      qty: 1,
    }));
    startTransition(async () => {
      const res = await createSale({ clientId: clientId || null, method, items });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
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
            <Button className="w-full" loading={pending} disabled={total === 0} onClick={submit}>
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
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-text-2">Cliente</span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-10 rounded-md border border-border bg-inset px-3 text-body text-text focus-visible:border-focus focus-visible:outline-none"
              >
                <option value="">Venda de balcão</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Section label="Serviços">
              {services.map((s) => (
                <Chip key={s.id} active={!!picked[s.id]} onClick={() => toggle("service", s)} name={s.name} price={s.price_brl} />
              ))}
            </Section>
            <Section label="Produtos">
              {products.map((p) => (
                <Chip key={p.id} active={!!picked[p.id]} onClick={() => toggle("product", p)} name={p.name} price={p.price_brl} />
              ))}
            </Section>

            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-text-2">Pagamento</span>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      "rounded-md border py-2 text-caption transition-colors",
                      method === m.value ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-caption text-danger">{error}</p>}
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
function Chip({ active, onClick, name, price }: { active: boolean; onClick: () => void; name: string; price: number }) {
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

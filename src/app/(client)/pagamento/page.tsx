"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatBRL, cn } from "@/lib/utils";
import { CURRENT_CLIENT } from "@/features/client/mock-data";

type Tab = "card" | "pix" | "other";

export default function PagamentoPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("card");
  const total = CURRENT_CLIENT.plan.priceBRL;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Pagamento</h1>

      <div className="flex gap-2">
        <TabBtn active={tab === "card"} onClick={() => setTab("card")} icon={<CreditCard size={16} />}>
          Cartão
        </TabBtn>
        <TabBtn active={tab === "pix"} onClick={() => setTab("pix")} icon={<QrCode size={16} />}>
          PIX
        </TabBtn>
        <TabBtn active={tab === "other"} onClick={() => setTab("other")} icon={<Banknote size={16} />}>
          Outras
        </TabBtn>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        {tab === "card" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Número do cartão</Label>
              <Input placeholder="0000 0000 0000 0000" inputMode="numeric" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nome no cartão</Label>
              <Input placeholder="WILLIAM S DE OLIVEIRA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Validade</Label>
                <Input placeholder="MM/AA" inputMode="numeric" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CVV</Label>
                <Input placeholder="123" inputMode="numeric" />
              </div>
            </div>
            <p className="text-caption text-text-muted">
              Assinatura recorrente — cobramos {formatBRL(total)} todo dia 05. Cancele quando quiser.
            </p>
          </div>
        )}

        {tab === "pix" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-md border border-border bg-inset text-text-muted">
              <QrCode size={72} />
            </div>
            <p className="text-caption text-text-2">
              Escaneie o QR ou use o PIX Copia e Cola. O código expira em 30 minutos.
            </p>
            <Button variant="outline" size="sm">Copiar código PIX</Button>
          </div>
        )}

        {tab === "other" && (
          <ul className="flex flex-col gap-2 text-body text-text-2">
            <li className="rounded-md border border-border px-4 py-3">Cartão de débito</li>
            <li className="rounded-md border border-border px-4 py-3">Dinheiro na unidade</li>
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-elevated px-5 py-4">
        <span className="text-body text-text-2">Total</span>
        <span className="text-h3 text-accent tabular">{formatBRL(total)}</span>
      </div>

      <Button size="lg" onClick={() => router.push("/boas-vindas")}>
        Pagar {formatBRL(total)}
      </Button>
      <Link href="/suporte" className="text-center text-caption text-text-muted hover:text-accent">
        Precisa de ajuda? Falar com o suporte
      </Link>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md border py-2.5 text-body transition-colors",
        active ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

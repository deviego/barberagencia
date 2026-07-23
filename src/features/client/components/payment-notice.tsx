"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Modal informativo de pagamento — aparece ao abrir a tela de agendamento. */
export function PaymentNotice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[400px] max-w-full rounded-lg border border-border bg-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-wash text-accent">
            <Wallet size={20} />
          </span>
          <h3 className="text-h4 font-semibold text-text">Pagamento somente local</h3>
        </div>
        <p className="text-body leading-relaxed text-text-2">
          O pagamento do serviço é realizado diretamente no local. Aceitamos cartões, PIX ou dinheiro
          — se precisar de troco, por favor, solicite antecipadamente no WhatsApp.
        </p>
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>
          Entendi
        </Button>
      </div>
    </div>
  );
}

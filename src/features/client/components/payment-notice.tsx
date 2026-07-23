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
          <h3 className="text-h4 font-semibold text-text">Pagamento no local</h3>
        </div>
        <p className="text-body leading-relaxed text-text-2">
          O pagamento é feito no local após o atendimento — dinheiro, PIX ou cartão. Vai pagar em
          dinheiro? Se precisar de troco, avise o barbeiro ao chegar. Aproveite! ✂️
        </p>
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>
          Entendi
        </Button>
      </div>
    </div>
  );
}

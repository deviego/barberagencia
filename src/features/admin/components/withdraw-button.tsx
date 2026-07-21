"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { registerWithdrawal } from "@/features/admin/actions";

export function WithdrawButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) return;
    startTransition(async () => {
      await registerWithdrawal(value, note || undefined);
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Banknote size={16} />
        Registrar saque
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar saque"
        footer={
          <Button className="w-full" loading={pending} onClick={submit}>
            Registrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: retirada do caixa" />
          </div>
        </div>
      </Drawer>
    </>
  );
}

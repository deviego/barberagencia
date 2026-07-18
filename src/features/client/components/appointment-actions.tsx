"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CancelRefundModal } from "./cancel-refund-modal";

export function AppointmentActions({
  isPlan = true,
  size = "sm",
}: {
  isPlan?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-caption text-text-muted">Cancelado — reembolso a caminho</span>;
  }

  return (
    <>
      <div className="flex gap-3">
        <Button variant="outline" size={size}>
          Reagendar
        </Button>
        <Button variant="ghost" size={size} onClick={() => setOpen(true)}>
          Cancelar
        </Button>
      </div>
      <CancelRefundModal
        open={open}
        onClose={() => setOpen(false)}
        isPlan={isPlan}
        onConfirm={() => setDone(true)}
      />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CancelRefundModal } from "./cancel-refund-modal";
import { cancelAppointment } from "@/features/client/actions";

export function AppointmentActions({
  appointmentId,
  isPlan = true,
  size = "sm",
}: {
  appointmentId?: string;
  isPlan?: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="text-caption text-text-muted">Cancelado</span>;
  }

  function confirmCancel() {
    if (!appointmentId) {
      setDone(true);
      return;
    }
    startTransition(async () => {
      const res = await cancelAppointment(appointmentId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex gap-3">
        <Button variant="outline" size={size} onClick={() => router.push("/agendar")}>
          Reagendar
        </Button>
        <Button variant="ghost" size={size} loading={pending} onClick={() => setOpen(true)}>
          Cancelar
        </Button>
      </div>
      <CancelRefundModal
        open={open}
        onClose={() => setOpen(false)}
        isPlan={isPlan}
        onConfirm={confirmCancel}
      />
    </>
  );
}

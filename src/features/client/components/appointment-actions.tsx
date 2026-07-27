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
  status,
}: {
  appointmentId?: string;
  isPlan?: boolean;
  size?: "sm" | "md";
  status?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // Confirmado → só cancelar; enquanto aguardando/alternativa → pode reagendar também.
  const canReschedule = status ? status !== "CONFIRMED" : true;

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
        {canReschedule && (
          <Button
            variant="outline"
            size={size}
            onClick={() => router.push(appointmentId ? `/client/reagendar/${appointmentId}` : "/client/agendar")}
          >
            Reagendar
          </Button>
        )}
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

"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Truck, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setOrderStatus } from "../actions";

type Action = { status: string; label: string; icon: React.ReactNode; variant?: "primary" | "outline" | "ghost" };

const BY_STATUS: Record<string, Action[]> = {
  PLACED: [
    { status: "CONFIRMED", label: "Aceitar", icon: <Check size={15} /> },
    { status: "CANCELLED", label: "Recusar", icon: <X size={15} />, variant: "ghost" },
  ],
  CONFIRMED: [
    { status: "SHIPPED", label: "Enviar", icon: <Truck size={15} /> },
    { status: "CANCELLED", label: "Cancelar", icon: <X size={15} />, variant: "ghost" },
  ],
  SHIPPED: [
    { status: "DELIVERED", label: "Marcar entregue", icon: <PackageCheck size={15} /> },
    { status: "CANCELLED", label: "Cancelar", icon: <X size={15} />, variant: "ghost" },
  ],
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const actions = BY_STATUS[status] ?? [];
  if (!actions.length) return null;

  function run(next: string) {
    setErr(null);
    startTransition(async () => {
      const res = await setOrderStatus(orderId, next);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Falha.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <Button key={a.status} size="sm" variant={a.variant ?? "primary"} loading={pending} onClick={() => run(a.status)}>
          {a.icon} {a.label}
        </Button>
      ))}
      {err && <span className="text-caption text-danger">{err}</span>}
    </div>
  );
}

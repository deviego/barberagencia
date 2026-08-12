"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeftRight, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { approveFixedPlanRequest, approvePlanRequest, rejectPlanRequest } from "@/features/admin/actions";
import { FixedSlotFields, timeToMin, type FixedSlot } from "@/features/admin/components/fixed-slot-fields";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Opt {
  id: string;
  name: string;
}

export interface PlanRequestRow {
  id: string;
  type: "CHANGE" | "CANCEL" | "SUBSCRIBE";
  created_at: string;
  combo_plan_id?: string | null;
  client_id?: string;
  clients: unknown;
  combo_plans: unknown;
}

export function PlanRequestCard({ req, barbers = [], services = [] }: { req: PlanRequestRow; barbers?: Opt[]; services?: Opt[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slotOpen, setSlotOpen] = useState(false);
  const [slot, setSlot] = useState<FixedSlot>({ weekday: 1, time: "09:00", barberId: "" });
  const [error, setError] = useState<string | null>(null);

  const client = one(req.clients as { name: string }[] | { name: string });
  const combo = one(req.combo_plans as { name: string; booking_mode?: string }[] | { name: string; booking_mode?: string });
  const isCancel = req.type === "CANCEL";
  const isSubscribe = req.type === "SUBSCRIBE";
  const isFixed = combo?.booking_mode === "FIXED" && !isCancel;
  const planName = combo?.name ?? "outro plano";

  function act(fn: (id: string) => Promise<unknown>) {
    startTransition(async () => {
      await fn(req.id);
      router.refresh();
    });
  }

  function onApprove() {
    if (isFixed) {
      setSlotOpen(true);
      return;
    }
    act(approvePlanRequest);
  }

  function confirmFixed() {
    setError(null);
    if (!slot.barberId || !slot.time) {
      setError("Defina dia, horário e barbeiro.");
      return;
    }
    startTransition(async () => {
      const res = await approveFixedPlanRequest(req.id, {
        weekday: slot.weekday,
        startMin: timeToMin(slot.time),
        barberId: slot.barberId,
      });
      if (res.ok) {
        setSlotOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  const badge = isCancel
    ? { label: "Cancelamento", variant: "danger" as const }
    : isSubscribe
      ? { label: "Nova assinatura", variant: "success" as const }
      : { label: "Troca de plano", variant: "info" as const };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-inset text-accent">
            {isCancel ? <XCircle size={16} /> : isSubscribe ? <Sparkles size={16} /> : <ArrowLeftRight size={16} />}
          </span>
          <div>
            <div className="text-body font-semibold text-text">{client?.name ?? "Cliente"}</div>
            <div className="text-caption text-text-muted tabular">
              {format(new Date(req.created_at), "dd MMM · HH:mm", { locale: ptBR })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isFixed && <Badge variant="warning">Fixo</Badge>}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>

      <p className="text-caption text-text-2">
        {isCancel
          ? "O cliente pediu para cancelar a assinatura."
          : isSubscribe
            ? `O cliente quer assinar o "${planName}".`
            : `O cliente quer trocar para "${planName}".`}
        {isFixed ? " Plano de horário fixo — defina o dia/horário ao aprovar." : ""}
      </p>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" loading={pending} onClick={onApprove}>
          {isCancel ? "Confirmar cancelamento" : isFixed ? "Definir horário e aprovar" : isSubscribe ? "Aprovar assinatura" : "Aprovar troca"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(rejectPlanRequest)}>
          Recusar
        </Button>
      </div>

      <Drawer
        open={slotOpen}
        onClose={() => setSlotOpen(false)}
        title={`Ativar plano fixo · ${client?.name ?? "cliente"}`}
        footer={
          <Button className="w-full" loading={pending} onClick={confirmFixed}>
            Ativar e reservar cortes
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FixedSlotFields barbers={barbers} value={slot} onChange={setSlot} />
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
      </Drawer>
    </div>
  );
}

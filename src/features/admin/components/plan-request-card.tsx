"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeftRight, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { approvePlanRequest, rejectPlanRequest } from "@/features/admin/actions";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export interface PlanRequestRow {
  id: string;
  type: "CHANGE" | "CANCEL" | "SUBSCRIBE";
  created_at: string;
  clients: unknown;
  combo_plans: unknown;
}

export function PlanRequestCard({ req }: { req: PlanRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const client = one(req.clients as { name: string }[] | { name: string });
  const combo = one(req.combo_plans as { name: string }[] | { name: string });
  const isCancel = req.type === "CANCEL";
  const isSubscribe = req.type === "SUBSCRIBE";
  const planName = combo?.name ?? "outro plano";

  function act(fn: (id: string) => Promise<unknown>) {
    startTransition(async () => {
      await fn(req.id);
      router.refresh();
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
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <p className="text-caption text-text-2">
        {isCancel
          ? "O cliente pediu para cancelar a assinatura."
          : isSubscribe
            ? `O cliente quer assinar o "${planName}".`
            : `O cliente quer trocar para "${planName}".`}
      </p>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" loading={pending} onClick={() => act(approvePlanRequest)}>
          {isCancel ? "Confirmar cancelamento" : isSubscribe ? "Aprovar assinatura" : "Aprovar troca"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(rejectPlanRequest)}>
          Recusar
        </Button>
      </div>
    </div>
  );
}

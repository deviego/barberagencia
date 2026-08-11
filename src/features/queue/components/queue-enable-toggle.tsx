"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setQueueEnabled } from "../actions";

/** Toggle do MASTER para habilitar/desabilitar a Fila da barbearia. */
export function QueueEnableToggle({ tenantId, enabled }: { tenantId: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(v: boolean) {
    setMsg(null);
    startTransition(async () => {
      const res = await setQueueEnabled(tenantId, v);
      setMsg(res.ok ? "Fila atualizada." : res.error ?? "Falha.");
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
      <div>
        <div className="text-body font-semibold text-text">Fila (QR/totem)</div>
        <div className="text-caption text-text-muted">
          {msg ?? "Habilita a fila de atendimento por ordem de chegada (Essencial/Advance)."}
        </div>
      </div>
      <Switch defaultChecked={enabled} onChange={toggle} />
    </div>
  );
}

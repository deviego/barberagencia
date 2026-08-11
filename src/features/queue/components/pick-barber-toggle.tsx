"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setQueuePickBarber } from "../actions";

/** Config da barbearia: cliente pode escolher o barbeiro ao entrar na fila. */
export function PickBarberToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(v: boolean) {
    setMsg(null);
    startTransition(async () => {
      const res = await setQueuePickBarber(v);
      setMsg(res.ok ? "Preferência salva." : res.error ?? "Falha.");
    });
  }

  return (
    <section className="flex items-center justify-between rounded-lg border border-border bg-surface p-5">
      <div>
        <div className="text-body font-semibold text-text">Fila — cliente escolhe o barbeiro</div>
        <div className="text-caption text-text-muted">
          {msg ?? "Se ligado, o cliente pode escolher o profissional ao entrar na fila."}
        </div>
      </div>
      <Switch defaultChecked={enabled} onChange={toggle} />
    </section>
  );
}

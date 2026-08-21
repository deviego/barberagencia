"use client";

import { useState, useTransition } from "react";
import { Send, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendReportNow } from "@/features/platform/actions";

/** Botão do master: envia o relatório mensal AGORA no WhatsApp (mesmo fluxo do cron). */
export function SendReportButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendReportNow();
      if (!res.ok) {
        setMsg({ ok: false, text: res.error ?? "Falha ao enviar." });
        return;
      }
      const out = res.out ?? [];
      const enviados = out.filter((o) => o.ok).length;
      const falhas = out.filter((o) => !o.ok);
      setMsg({
        ok: falhas.length === 0,
        text:
          falhas.length === 0
            ? `Relatório enviado para ${enviados} número(s).`
            : `${enviados} enviado(s), ${falhas.length} falhou(aram): ${falhas.map((f) => f.phone).join(", ")}`,
      });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 print:hidden">
      <Button onClick={run} loading={pending}>
        <Send size={16} /> Enviar agora no WhatsApp
      </Button>
      {msg && (
        <span className={`flex items-center gap-1 text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {msg.text}
        </span>
      )}
    </div>
  );
}

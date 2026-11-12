"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestFinancialReport } from "@/features/admin/actions";

/** Botão "Solicitar relatório" — gera o relatório do mês e envia no WhatsApp da barbearia. */
export function RequestReportButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await requestFinancialReport();
      setMsg(
        r.ok
          ? { ok: true, text: "Relatório do mês sendo enviado no WhatsApp da barbearia ✅" }
          : { ok: false, text: r.error ?? "Falha ao solicitar." }
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" loading={pending} onClick={run}>
        <FileText size={16} /> Solicitar relatório
      </Button>
      {msg && <span className={`max-w-[260px] text-right text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>{msg.text}</span>}
    </div>
  );
}

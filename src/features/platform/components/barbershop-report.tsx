"use client";

import { useState, useTransition } from "react";
import { Download, Send, Check, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { sendBarbershopReport } from "@/features/platform/actions";

/** Relatório da barbearia (no detalhe do master): filtro de período + baixar PDF + enviar no WhatsApp. */
export function BarbershopReport({ tenantId }: { tenantId: string }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [from, setFrom] = useState(iso(first));
  const [to, setTo] = useState(iso(today));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pdfUrl = `/api/master/report/pdf?tenant=${tenantId}&from=${from}&to=${to}`;

  function send() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendBarbershopReport(tenantId, from, to);
      setMsg(
        res.ok
          ? { ok: true, text: `Relatório enviado no WhatsApp${res.phone ? ` para ${res.phone}` : ""}.` }
          : { ok: false, text: res.error ?? "Falha ao enviar." }
      );
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-text-muted" />
        <h2 className="text-h5 font-bold text-text">Relatório da barbearia</h2>
      </div>
      <p className="text-caption text-text-2">
        Escolha o período e gere o relatório profissional em PDF: resumo financeiro (entradas, saídas, resultado,
        ticket médio e receita recorrente), crescimento vs. período anterior, faturamento por método, por serviço e
        produtos vendidos, faturamento por dia, melhores clientes, assinantes ativos e novos clientes. Baixe o PDF ou
        envie direto no WhatsApp da barbearia.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Download size={16} /> Baixar PDF
          </Button>
        </a>
        <Button onClick={send} loading={pending}>
          <Send size={16} /> Enviar no WhatsApp
        </Button>
      </div>

      {msg && (
        <span className={`flex items-center gap-1 text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {msg.text}
        </span>
      )}
    </section>
  );
}

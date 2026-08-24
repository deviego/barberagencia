"use client";

import { useState, useTransition } from "react";
import { CreditCard, Check, AlertTriangle, Ban, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { brlInputFromNumber, parseBRLToNumber, maskBRL } from "@/lib/masks";
import { formatBRL } from "@/lib/utils";
import { registerSaasPayment, setTenantStatus } from "../actions";
import type { SaasBilling } from "../data";

const STATE: Record<SaasBilling["state"], { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  ACTIVE: { label: "Em dia", variant: "success" },
  TRIAL: { label: "Em teste", variant: "info" },
  OVERDUE: { label: "Vencido", variant: "danger" },
  SUSPENDED: { label: "Suspenso", variant: "danger" },
  UNKNOWN: { label: "Sem cobrança", variant: "warning" },
};

const METHODS = [
  { v: "PIX", label: "PIX" },
  { v: "CASH", label: "Dinheiro" },
  { v: "CARD", label: "Cartão" },
  { v: "OUTRO", label: "Outro" },
];

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

/** Cobrança da mensalidade do SaaS (MASTER): status, registrar pagamento/renovar, suspender. */
export function MasterBillingPanel({ tenantId, billing }: { tenantId: string; billing: SaasBilling }) {
  const [amount, setAmount] = useState(brlInputFromNumber(billing.priceBrl));
  const [method, setMethod] = useState("PIX");
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const st = STATE[billing.state];

  function register() {
    setMsg(null);
    startTransition(async () => {
      const res = await registerSaasPayment({ tenantId, amountBrl: parseBRLToNumber(amount), method, months, note });
      setMsg(res.ok ? { ok: true, text: `Pagamento registrado. Vigência até ${fmtDate(res.paidUntil)}.` } : { ok: false, text: res.error ?? "Falha." });
    });
  }

  function toggleStatus() {
    setMsg(null);
    const next = billing.tenantStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    startTransition(async () => {
      const res = await setTenantStatus(tenantId, next);
      setMsg(res.ok ? { ok: true, text: next === "SUSPENDED" ? "Barbearia suspensa." : "Barbearia reativada." } : { ok: false, text: res.error ?? "Falha." });
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <CreditCard size={16} className="text-text-muted" />
        <h2 className="text-h5 font-bold text-text">Assinatura / Mensalidade</h2>
        <Badge variant={st.variant}>{st.label}</Badge>
        <span className="ml-auto text-caption text-text-muted">
          {billing.planLabel} · {formatBRL(billing.priceBrl)}/mês
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-text-2">
        <span>Pago até: <strong className="text-text">{fmtDate(billing.paidUntil)}</strong></span>
        {billing.trialActive && <span>Teste até: <strong className="text-text">{fmtDate(billing.trialEndsAt)}</strong></span>}
        <span>Status da conta: <strong className="text-text">{billing.tenantStatus}</strong></span>
      </div>

      {!billing.configured && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning-strong/30 bg-warning-bg/40 px-3 py-2 text-caption text-warning-strong">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Cobrança ainda não ativada no banco. Aplique <code>supabase/schema-23-saas-billing.sql</code> para registrar pagamentos.
        </p>
      )}

      {/* Registrar pagamento / renovar */}
      <div className="grid gap-3 rounded-lg border border-border bg-inset p-4 sm:grid-cols-[1fr_1fr_100px]">
        <div className="flex flex-col gap-1.5">
          <Label>Valor recebido</Label>
          <Input value={amount} onChange={(e) => setAmount(maskBRL(e.target.value))} placeholder="R$ 0,00" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Método</Label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-body text-text"
          >
            {METHODS.map((m) => (
              <option key={m.v} value={m.v}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Meses</Label>
          <Input type="number" min={1} max={24} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-3">
          <Label>Observação (opcional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex.: pago via PIX em 24/08" />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button onClick={register} loading={pending}>
            <Check size={15} /> Registrar pagamento / Renovar
          </Button>
          <Button variant={billing.tenantStatus === "SUSPENDED" ? "outline" : "ghost"} onClick={toggleStatus} loading={pending}>
            {billing.tenantStatus === "SUSPENDED" ? <><RefreshCw size={15} /> Reativar</> : <><Ban size={15} /> Suspender</>}
          </Button>
          {msg && <span className={`text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </div>

      {/* Histórico */}
      {billing.payments.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
                <th className="px-4 py-2.5 font-semibold">Pago em</th>
                <th className="px-4 py-2.5 font-semibold">Método</th>
                <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-4 py-2.5 font-semibold">Vigência até</th>
                <th className="px-4 py-2.5 font-semibold">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {billing.payments.map((p, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td className="px-4 py-2.5 text-text tabular">{fmtDate(p.paidAt)}</td>
                  <td className="px-4 py-2.5 text-text-2">{p.method ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-text tabular">{formatBRL(p.amountBrl)}</td>
                  <td className="px-4 py-2.5 text-text-2 tabular">{fmtDate(p.paidUntil)}</td>
                  <td className="px-4 py-2.5 text-text-2">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

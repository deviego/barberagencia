"use client";

import { useMemo, useState, useTransition } from "react";
import { CreditCard, Check, AlertTriangle, Ban, RefreshCw, Pencil, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { brlInputFromNumber, parseBRLToNumber, maskBRL } from "@/lib/masks";
import { formatBRL } from "@/lib/utils";
import { registerSaasPayment, setTenantStatus, updateBillingTerms } from "../actions";
import type { SaasBilling } from "../data";
import { suggestPayment } from "@/lib/billing/saas-pricing";

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
  const [method, setMethod] = useState("PIX");
  const [months, setMonths] = useState(1);
  const [partial, setPartial] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const st = STATE[billing.state];

  // Valor sugerido por competência (S1). Sem condições (distribuidor) ou sem schema-34: preço fixo, como antes.
  const usesCompetencia = !!billing.terms && billing.competenciaConfigured;
  const suggestion = useMemo(
    () => (usesCompetencia && billing.terms ? suggestPayment(billing.terms, billing.ledger, partial ? 1 : months, billing.nowIso) : null),
    [usesCompetencia, billing.terms, billing.ledger, billing.nowIso, months, partial]
  );
  const suggestedAmount = suggestion
    ? suggestion.kind === "NEW" && partial
      ? Math.round(suggestion.amountBrl * 50) / 100 // 1ª parte = metade (condicoes-aprovadas.md)
      : suggestion.amountBrl
    : billing.priceBrl;

  // A sugestão nunca sobrescreve o que o master digitou.
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const amount = typedAmount ?? brlInputFromNumber(suggestedAmount);
  const remaining = suggestion?.kind === "REMAINING";

  function register() {
    setMsg(null);
    startTransition(async () => {
      const res = await registerSaasPayment({
        tenantId,
        amountBrl: parseBRLToNumber(amount),
        method,
        months: remaining || partial ? 1 : months,
        note,
        partial: !remaining && partial,
      });
      if (res.ok) {
        setTypedAmount(null);
        setPartial(false);
        setNote("");
      }
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
          {billing.planLabel} · {formatBRL(billing.terms?.fullPriceBrl ?? billing.priceBrl)}/mês
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

      {billing.terms && <TermsBlock tenantId={tenantId} billing={billing} />}

      {billing.terms && !billing.competenciaConfigured && billing.configured && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning-strong/30 bg-warning-bg/40 px-3 py-2 text-caption text-warning-strong">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Valor por competência desligado. Aplique <code>supabase/schema-34-billing-terms.sql</code>.
        </p>
      )}

      {billing.planUnknown && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning-strong/30 bg-warning-bg/40 px-3 py-2 text-caption text-warning-strong">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Confira o valor combinado com a barbearia.
        </p>
      )}

      {/* Registrar pagamento / renovar */}
      <div className="grid gap-3 rounded-lg border border-border bg-inset p-4 sm:grid-cols-[1fr_1fr_100px]">
        <div className="flex flex-col gap-1.5">
          <Label>Valor recebido</Label>
          <Input value={amount} onChange={(e) => setTypedAmount(maskBRL(e.target.value))} placeholder="R$ 0,00" />
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
          <Input
            type="number"
            min={1}
            max={24}
            value={remaining || partial ? 1 : months}
            disabled={remaining || partial}
            onChange={(e) => {
              setMonths(Number(e.target.value));
              setTypedAmount(null);
            }}
          />
        </div>
        {suggestion && <SuggestionHint suggestion={suggestion} terms={billing.terms!} partial={partial} />}
        {suggestion?.kind === "NEW" && (
          <label className="flex items-center gap-2 text-caption text-text-2 sm:col-span-3">
            <input
              type="checkbox"
              checked={partial}
              onChange={(e) => {
                setPartial(e.target.checked);
                setTypedAmount(null);
              }}
            />
            1ª parte de uma mensalidade paga em duas vezes (a outra metade fica como pendente)
          </label>
        )}
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

function SuggestionHint({
  suggestion,
  terms,
  partial,
}: {
  suggestion: NonNullable<ReturnType<typeof suggestPayment>>;
  terms: NonNullable<SaasBilling["terms"]>;
  partial: boolean;
}) {
  if (suggestion.kind === "REMAINING") {
    return (
      <p className="flex items-center gap-1.5 text-caption text-warning-strong sm:col-span-3">
        <AlertTriangle size={14} /> {suggestion.text}
      </p>
    );
  }
  const promoN = terms.promoMonths;
  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-text-2 sm:col-span-3">
      {suggestion.firstCharge && suggestion.promoUntilLabel ? (
        <Badge variant="info">
          <Tag size={12} /> 1ª mensalidade — promoção nas {promoN} primeiras competências
        </Badge>
      ) : suggestion.promoUntilLabel ? (
        <Badge variant="info">
          <Tag size={12} /> Promoção até a competência {suggestion.promoUntilLabel}
        </Badge>
      ) : null}
      <span>
        Competência {suggestion.label}
        {suggestion.competenciaTo > suggestion.competenciaFrom ? ` + ${suggestion.competenciaTo - suggestion.competenciaFrom}` : ""}
        {partial ? ` · 1ª parte de ${formatBRL(suggestion.amountBrl)}` : ""}
      </span>
      {suggestion.breakdown && <span className="text-text-muted">Nota automática: {suggestion.breakdown}</span>}
    </div>
  );
}

/** Condições vendidas (S0): o que foi fechado com a barbearia. Edição vale da próxima competência. */
function TermsBlock({ tenantId, billing }: { tenantId: string; billing: SaasBilling }) {
  const terms = billing.terms!;
  const [editing, setEditing] = useState(false);
  const [promo, setPromo] = useState(terms.promoPriceBrl == null ? "" : brlInputFromNumber(terms.promoPriceBrl));
  const [promoMonths, setPromoMonths] = useState(terms.promoMonths);
  const [full, setFull] = useState(brlInputFromNumber(terms.fullPriceBrl));
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setErr(null);
    const promoValue = promo.trim() ? parseBRLToNumber(promo) : null;
    startTransition(async () => {
      const res = await updateBillingTerms({
        tenantId,
        promoPriceBrl: promoValue,
        promoMonths: promoValue == null ? 0 : promoMonths,
        fullPriceBrl: parseBRLToNumber(full),
      });
      if (res.ok) setEditing(false);
      else setErr(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-inset p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body font-bold text-text">Condições vendidas</h3>
        {!billing.termsStored && <Badge variant="warning">Tabela padrão (não gravada)</Badge>}
        {!editing && billing.competenciaConfigured && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Editar condições
          </Button>
        )}
      </div>
      {!editing ? (
        <div className="flex flex-col gap-0.5 text-caption text-text-2">
          {terms.promoPriceBrl != null && terms.promoMonths > 0 && (
            <span>
              Promoção: <strong className="text-text">{formatBRL(terms.promoPriceBrl)}</strong> nas {terms.promoMonths} primeiras mensalidades
            </span>
          )}
          <span>
            {terms.promoPriceBrl != null && terms.promoMonths > 0 ? "Depois: " : "Mensalidade: "}
            <strong className="text-text">{formatBRL(terms.fullPriceBrl)}/mês</strong>
          </span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Preço promocional</Label>
            <Input value={promo} onChange={(e) => setPromo(maskBRL(e.target.value))} placeholder="sem promoção" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Mensalidades na promoção</Label>
            <Input type="number" min={0} max={24} value={promoMonths} onChange={(e) => setPromoMonths(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Preço cheio</Label>
            <Input value={full} onChange={(e) => setFull(maskBRL(e.target.value))} placeholder="R$ 0,00" />
          </div>
          <p className="text-caption text-text-muted sm:col-span-3">Vale da próxima competência em diante. As já pagas não mudam.</p>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <Button size="sm" onClick={save} loading={pending}>
              <Check size={14} /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
            {err && <span className="text-caption text-danger">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

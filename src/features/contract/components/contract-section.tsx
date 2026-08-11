"use client";

import { useState, useTransition } from "react";
import { FileText, Printer, ChevronDown, Check, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContractDocument } from "./contract-document";
import { signContract } from "../actions";
import { ACCEPT_TEXT } from "../parties";
import type { ContractView } from "../view";

function trialLabel(v: ContractView) {
  if (v.signature.status === "SIGNED") return "Contrato assinado";
  const ends = new Date(v.trialEndsAt);
  const ended = ends.getTime() <= Date.now();
  const d = ends.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!v.trialEnabled) return "Sem período de teste — contrato pendente de assinatura";
  return ended ? `Período de teste encerrado em ${d}` : `Período de teste até ${d}`;
}

/** Seção "Contrato" em Configurações — vê o contrato, os dados e assina (admin). */
export function ContractSection({ view }: { view: ContractView }) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const signed = view.signature.status === "SIGNED";
  const f = view.fields;

  function sign() {
    setError(null);
    startTransition(async () => {
      const res = await signContract();
      if (!res.ok) setError(res.error ?? "Falha ao assinar.");
    });
  }

  const data: [string, string | null | undefined][] = [
    ["Nome fantasia", f.tradeName],
    ["Razão social", f.legalName],
    [f.docType || "CNPJ/CPF", f.docNumber],
    ["Responsável legal", f.responsibleName],
    ["CPF do responsável", f.responsibleCpf],
    ["Endereço", [f.addressStreet, f.addressCity && f.addressState ? `${f.addressCity}/${f.addressState}` : f.addressCity, f.addressZip].filter(Boolean).join(", ") || null],
    ["Plano", f.planLabel],
  ];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="contrato">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-text-muted" />
          <div className="text-overline uppercase text-text-muted">Contrato de assinatura</div>
        </div>
        <Badge variant={signed ? "success" : "warning"}>{signed ? "Assinado" : "Pendente"}</Badge>
      </div>

      <p className="text-caption text-text-2">{trialLabel(view)}</p>

      {/* Dados informados */}
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {data.map(([label, val]) => (
          <div key={label} className="flex flex-col">
            <span className="text-caption text-text-muted">{label}</span>
            <span className="text-body text-text">{val && String(val).trim() ? val : "—"}</span>
          </div>
        ))}
      </div>

      {!view.dataComplete && !signed && (
        <p className="rounded-md border border-warning-strong/30 bg-warning-bg/40 px-3 py-2 text-caption text-warning-strong">
          Os dados da barbearia ainda não foram totalmente preenchidos. Fale com o suporte para completar
          antes de assinar.
        </p>
      )}

      {/* Documento (expandível) */}
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline"
        >
          <ChevronDown size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          {open ? "Ocultar contrato" : "Ler contrato completo"}
        </button>
        {open && (
          <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-inset p-4 print:max-h-none print:overflow-visible">
            <ContractDocument fields={f} signature={view.signature} />
          </div>
        )}
      </div>

      {/* Ações */}
      {signed ? (
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-success-strong" />
          <span className="text-caption text-text-2">
            Assinado eletronicamente{view.signature.signedAt ? ` em ${new Date(view.signature.signedAt).toLocaleDateString("pt-BR")}` : ""}.
          </span>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="ml-auto">
            <Printer size={14} /> Imprimir
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={() => setAccepted((a) => !a)}
            className="flex items-start gap-2.5 text-left"
            disabled={!view.dataComplete}
          >
            <Checkbox checked={accepted} />
            <span className="text-caption text-text-2">{ACCEPT_TEXT}</span>
          </button>
          {error && <p className="text-caption text-danger">{error}</p>}
          <Button onClick={sign} loading={pending} disabled={!accepted || !view.dataComplete} className="w-fit">
            <Check size={15} /> Assinar contrato
          </Button>
        </div>
      )}
    </section>
  );
}

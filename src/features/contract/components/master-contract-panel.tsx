"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContractDocument } from "./contract-document";
import { ContractDataFields } from "./contract-data-fields";
import { ContractPrintButton } from "./contract-print-button";
import { updateContractData } from "../actions";
import type { ContractView, ContractDataValue } from "../view";

/** Painel de contrato no detalhe da barbearia (MASTER): status, dados legais editáveis e documento. */
export function MasterContractPanel({
  tenantId,
  view,
  initial,
}: {
  tenantId: string;
  view: ContractView;
  initial: ContractDataValue;
}) {
  const [open, setOpen] = useState(false);
  const signed = view.signature.status === "SIGNED";

  const trialEnds = new Date(view.trialEndsAt);
  const trialLabel = signed
    ? "Assinado"
    : view.trialEnabled
      ? `Teste até ${trialEnds.toLocaleDateString("pt-BR")}`
      : "Sem teste";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-h5 font-bold text-text">Contrato</h2>
        <Badge variant={signed ? "success" : "warning"}>{signed ? "Assinado" : "Pendente"}</Badge>
        <span className="text-caption text-text-muted">{trialLabel}</span>
        <ContractPrintButton className="ml-auto" />
      </div>

      {signed && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-success-strong/40 bg-success-bg/40 px-4 py-3 text-caption text-text-2">
          <span className="flex items-center gap-1.5 font-semibold text-success-strong">
            <ShieldCheck size={15} /> Assinado eletronicamente
          </span>
          {view.signature.signedAt && <span>em {new Date(view.signature.signedAt).toLocaleString("pt-BR")}</span>}
          {view.signature.signedName && <span>por {view.signature.signedName}</span>}
          {view.signature.signedIp && <span>IP {view.signature.signedIp}</span>}
        </div>
      )}

      {/* Dados legais editáveis (bloqueados após assinar) */}
      <ContractDataFields
        initial={initial}
        disabled={signed}
        onSave={(v) => updateContractData({ tenantId, ...v })}
      />

      {/* Documento */}
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline"
        >
          <ChevronDown size={15} className={open ? "rotate-180" : ""} />
          {open ? "Ocultar contrato" : "Ver contrato completo"}
        </button>
        {/* Sempre montado (para o "Baixar PDF" imprimir mesmo colapsado); só oculto na tela. */}
        <div
          className={`mt-3 rounded-md border border-border bg-inset p-4 ${
            open ? "max-h-[60vh] overflow-y-auto" : "max-h-0 overflow-hidden border-0 p-0"
          } print:max-h-none print:overflow-visible print:border-0`}
        >
          <ContractDocument fields={view.fields} signature={view.signature} />
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { maskCPF, maskCNPJ, maskCEP, maskUF } from "@/lib/masks";
import { ContractDocument } from "./contract-document";
import { updateContractData } from "../actions";
import type { ContractView } from "../view";

export type MasterContractInitial = {
  legalName: string;
  tradeName: string;
  docType: "CNPJ" | "CPF";
  docNumber: string;
  responsibleName: string;
  responsibleCpf: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
};

/** Painel de contrato no detalhe da barbearia (MASTER): status, dados legais editáveis e documento. */
export function MasterContractPanel({
  tenantId,
  view,
  initial,
  planLabel,
}: {
  tenantId: string;
  view: ContractView;
  initial: MasterContractInitial;
  planLabel: string | null;
}) {
  const [f, setF] = useState<MasterContractInitial>(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const signed = view.signature.status === "SIGNED";
  const set = (k: keyof MasterContractInitial, v: string) => setF((p) => ({ ...p, [k]: v }));

  const trialEnds = new Date(view.trialEndsAt);
  const trialLabel = signed
    ? "Assinado"
    : view.trialEnabled
      ? `Teste até ${trialEnds.toLocaleDateString("pt-BR")}`
      : "Sem teste";

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateContractData({ tenantId, ...f });
      setMsg(res.ok ? "Dados salvos." : res.error ?? "Falha ao salvar.");
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-h5 font-bold text-text">Contrato</h2>
        <Badge variant={signed ? "success" : "warning"}>{signed ? "Assinado" : "Pendente"}</Badge>
        <span className="text-caption text-text-muted">{trialLabel}</span>
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

      {/* Dados legais editáveis */}
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Nome fantasia</Label>
          <Input value={f.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Razão social</Label>
          <Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{f.docType}</Label>
          <div className="flex gap-2">
            {(["CNPJ", "CPF"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("docType", d)}
                className={`rounded-pill border px-3 py-1 text-caption ${
                  f.docType === d ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2"
                }`}
              >
                {d}
              </button>
            ))}
            <Input
              className="flex-1"
              value={f.docNumber}
              onChange={(e) => set("docNumber", f.docType === "CNPJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value))}
              placeholder={f.docType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Responsável legal</Label>
          <Input value={f.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>CPF do responsável</Label>
          <Input value={f.responsibleCpf} onChange={(e) => set("responsibleCpf", maskCPF(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Endereço</Label>
          <Input value={f.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_80px_120px]">
          <div className="flex flex-col gap-1.5">
            <Label>Cidade</Label>
            <Input value={f.addressCity} onChange={(e) => set("addressCity", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>UF</Label>
            <Input value={f.addressState} onChange={(e) => set("addressState", maskUF(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>CEP</Label>
            <Input value={f.addressZip} onChange={(e) => set("addressZip", maskCEP(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button onClick={save} loading={pending} size="sm">
            <Check size={14} /> Salvar dados
          </Button>
          {msg && <span className="text-caption text-text-2">{msg}</span>}
        </div>
      </div>

      {/* Documento */}
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline"
        >
          <ChevronDown size={15} className={open ? "rotate-180" : ""} />
          {open ? "Ocultar contrato" : "Ver contrato completo"}
        </button>
        {open && (
          <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-inset p-4">
            <ContractDocument
              fields={{
                tradeName: f.tradeName,
                legalName: f.legalName,
                docType: f.docType,
                docNumber: f.docNumber,
                responsibleName: f.responsibleName,
                responsibleCpf: f.responsibleCpf,
                addressStreet: f.addressStreet,
                addressCity: f.addressCity,
                addressState: f.addressState,
                addressZip: f.addressZip,
                planLabel,
              }}
              signature={view.signature}
            />
          </div>
        )}
      </div>
    </section>
  );
}

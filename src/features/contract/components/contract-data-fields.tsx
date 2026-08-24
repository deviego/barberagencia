"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { maskCPF, maskCNPJ, maskCEP, maskUF, maskPhoneBR } from "@/lib/masks";
import type { ContractDataValue } from "../view";

/** Formulário compartilhado (master/admin) para os dados cadastrais do contrato. */
export function ContractDataFields({
  initial,
  onSave,
  disabled,
}: {
  initial: ContractDataValue;
  onSave: (v: ContractDataValue) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
}) {
  const [f, setF] = useState<ContractDataValue>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof ContractDataValue, v: string) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await onSave(f);
      setMsg(res.ok ? { ok: true, text: "Dados salvos." } : { ok: false, text: res.error ?? "Falha ao salvar." });
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Nome fantasia</Label>
        <Input value={f.tradeName} onChange={(e) => set("tradeName", e.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Razão social</Label>
        <Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{f.docType}</Label>
        <div className="flex gap-2">
          {(["CNPJ", "CPF"] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
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
            disabled={disabled}
            value={f.docNumber}
            onChange={(e) => set("docNumber", f.docType === "CNPJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value))}
            placeholder={f.docType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Responsável legal</Label>
        <Input value={f.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>CPF do responsável</Label>
        <Input value={f.responsibleCpf} onChange={(e) => set("responsibleCpf", maskCPF(e.target.value))} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Endereço</Label>
        <Input value={f.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} placeholder="Rua, número, bairro" disabled={disabled} />
      </div>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_80px_120px]">
        <div className="flex flex-col gap-1.5">
          <Label>Cidade</Label>
          <Input value={f.addressCity} onChange={(e) => set("addressCity", e.target.value)} disabled={disabled} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>UF</Label>
          <Input value={f.addressState} onChange={(e) => set("addressState", maskUF(e.target.value))} disabled={disabled} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>CEP</Label>
          <Input value={f.addressZip} onChange={(e) => set("addressZip", maskCEP(e.target.value))} disabled={disabled} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>E-mail de contato</Label>
        <Input type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Telefone de contato</Label>
        <Input value={f.contactPhone} onChange={(e) => set("contactPhone", maskPhoneBR(e.target.value))} disabled={disabled} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button onClick={save} loading={pending} size="sm" disabled={disabled}>
          <Check size={14} /> Salvar dados
        </Button>
        {msg && <span className={`text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

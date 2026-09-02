"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { maskPhoneBR } from "@/lib/masks";
import { createPartner, updatePartner, type PartnerInput } from "../actions";
import type { Partner, PartnerType, CommissionKind } from "../data";

const TYPES: { v: PartnerType; label: string }[] = [
  { v: "EMBAIXADORA", label: "Embaixadora" },
  { v: "DIVULGADORA", label: "Divulgadora" },
  { v: "DISTRIBUIDOR", label: "Distribuidor" },
];
const COMM: { v: CommissionKind; label: string }[] = [
  { v: "PCT", label: "% da mensalidade" },
  { v: "FIXED", label: "Valor fixo / indicação" },
  { v: "NONE", label: "Sem comissão" },
];

export function PartnerForm({ tenants, initial, onSaved }: { tenants: { id: string; name: string }[]; initial?: Partner; onSaved?: () => void }) {
  const router = useRouter();
  const editing = !!initial;
  const [f, setF] = useState<PartnerInput>({
    name: initial?.name ?? "",
    type: initial?.type ?? "DIVULGADORA",
    isBarbershop: initial?.isBarbershop ?? false,
    tenantId: initial?.tenantId ?? null,
    contactName: initial?.contactName ?? "",
    contactPhone: initial?.contactPhone ?? "",
    contactEmail: initial?.contactEmail ?? "",
    instagram: initial?.instagram ?? "",
    commissionKind: initial?.commissionKind ?? "PCT",
    commissionValue: initial?.commissionValue ?? 0,
    notes: initial?.notes ?? "",
    active: initial?.active ?? true,
  });
  const set = <K extends keyof PartnerInput>(k: K, v: PartnerInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = editing ? await updatePartner(initial!.id, f) : await createPartner(f);
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Parceiro salvo." : "Parceiro criado." });
        router.refresh();
        onSaved?.();
        if (!editing) setF((p) => ({ ...p, name: "", contactName: "", contactPhone: "", contactEmail: "", instagram: "", notes: "" }));
      } else setMsg({ ok: false, text: res.error ?? "Falha." });
    });
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Nome do parceiro</Label>
        <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Maxi Stilo" />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Tipo</Label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => set("type", t.v)}
              className={`rounded-pill border px-4 py-1.5 text-caption transition-colors ${
                f.type === t.v ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-inset px-4 py-3 sm:col-span-2">
        <div>
          <div className="text-body font-semibold text-text">É uma barbearia?</div>
          <div className="text-caption text-text-muted">Se for cliente nosso, vincule à barbearia existente.</div>
        </div>
        <Switch defaultChecked={f.isBarbershop} onChange={(v) => set("isBarbershop", v)} />
      </div>

      {f.isBarbershop && (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Barbearia vinculada (opcional)</Label>
          <select
            value={f.tenantId ?? ""}
            onChange={(e) => set("tenantId", e.target.value || null)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-body text-text"
          >
            <option value="">— não cadastrada / nenhuma —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Contato (nome)</Label>
        <Input value={f.contactName ?? ""} onChange={(e) => set("contactName", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Telefone / WhatsApp</Label>
        <Input value={f.contactPhone ?? ""} onChange={(e) => set("contactPhone", maskPhoneBR(e.target.value))} inputMode="tel" placeholder="(11) 99999-9999" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>E-mail</Label>
        <Input type="email" value={f.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Instagram</Label>
        <Input value={f.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@maxistilo" />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Comissão</Label>
        <div className="flex flex-wrap gap-2">
          {COMM.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => set("commissionKind", c.v)}
              className={`rounded-pill border px-4 py-1.5 text-caption transition-colors ${
                f.commissionKind === c.v ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {f.commissionKind !== "NONE" && (
        <div className="flex flex-col gap-1.5">
          <Label>{f.commissionKind === "PCT" ? "Percentual (%)" : "Valor por indicação (R$)"}</Label>
          <Input
            type="number"
            min={0}
            step={f.commissionKind === "PCT" ? 1 : 0.01}
            value={f.commissionValue}
            onChange={(e) => set("commissionValue", Number(e.target.value))}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Observações</Label>
        <Input value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </div>

      {editing && (
        <div className="flex items-center justify-between rounded-md border border-border bg-inset px-4 py-3 sm:col-span-2">
          <div className="text-body font-semibold text-text">Ativo</div>
          <Switch defaultChecked={f.active} onChange={(v) => set("active", v)} />
        </div>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button onClick={save} loading={pending}>
          <Check size={15} /> {editing ? "Salvar" : "Criar parceiro"}
        </Button>
        {msg && <span className={`text-caption ${msg.ok ? "text-success-strong" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

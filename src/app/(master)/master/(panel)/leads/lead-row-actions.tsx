"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { anonymizeLead, setLeadStatus } from "@/features/leads/actions";
import type { LeadStatus } from "@/features/leads/rate-limit";

const STATUS_LABEL: Record<LeadStatus, string> = { NEW: "Novo", CONTACTED: "Contatado", DISCARDED: "Descartado" };

export function LeadRowActions({ id, status, anonymized }: { id: string; status: LeadStatus; anonymized: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erro.");
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          aria-label="Status do lead"
          className="h-8 rounded-md border border-border bg-surface px-2 text-caption text-text"
          value={status}
          disabled={pending}
          onChange={(e) => run(() => setLeadStatus(id, e.target.value as LeadStatus))}
        >
          {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {!anonymized &&
          (confirming ? (
            <>
              <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => anonymizeLead(id))}>
                Confirmar
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(true)}>
              Anonimizar
            </Button>
          ))}
      </div>
      {confirming && <span className="text-caption text-text-muted">Apaga nome, empresa, cidade e WhatsApp. Não dá para desfazer.</span>}
      {error && <span className="text-caption text-danger">{error}</span>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Modal obrigatório de Termos + Privacidade (handoff v2 — sem login social).
 * "Aceitar e continuar" só habilita com os dois checkboxes marcados.
 */
export function TermsModal({
  open,
  onClose,
  onAccept,
}: {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
}) {
  const [ck1, setCk1] = useState(false);
  const [ck2, setCk2] = useState(false);
  const both = ck1 && ck2;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex w-[420px] max-w-full flex-col gap-3.5 rounded-lg border border-border bg-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-h3 font-extrabold uppercase text-text">
          Termos e privacidade
        </div>
        <p className="text-caption text-text-2">
          Para criar sua conta, leia e aceite os documentos abaixo.
        </p>

        <button
          type="button"
          onClick={() => setCk1((v) => !v)}
          className="flex items-start gap-2.5 rounded-md border border-border p-3 text-left text-caption transition-colors hover:border-accent"
        >
          <Checkbox checked={ck1} />
          <span>
            Li e aceito os <span className="text-accent">Termos de Uso</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCk2((v) => !v)}
          className="flex items-start gap-2.5 rounded-md border border-border p-3 text-left text-caption transition-colors hover:border-accent"
        >
          <Checkbox checked={ck2} />
          <span>
            Li e aceito a <span className="text-accent">Política de Privacidade</span>
          </span>
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-3 text-body text-text transition-colors hover:border-accent"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={!both}
            onClick={onAccept}
            className="flex-[2] rounded-md py-3 text-body font-bold transition-colors disabled:cursor-not-allowed"
            style={{
              background: both ? "var(--bb-accent)" : "var(--bb-n700)",
              color: both ? "var(--bb-text-inverse)" : "var(--bb-n500)",
            }}
          >
            Aceitar e continuar
          </button>
        </div>
      </div>
    </div>
  );
}

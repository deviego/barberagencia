"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, X } from "lucide-react";

const KEY = "bb_contract_cta_dismissed";

/** CTA no dashboard: completar os dados do contrato. Dispensável por sessão. */
export function ContractCtaBanner({ dataComplete }: { dataComplete: boolean }) {
  const [dismissed, setDismissed] = useState(true); // começa oculto (evita flash antes de ler o storage)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent-wash px-5 py-4">
      <div className="flex items-center gap-3">
        <FileText size={20} className="text-accent" />
        <span className="text-body text-text">
          {dataComplete
            ? "Seu contrato está pronto para assinatura."
            : "Complete os dados cadastrais da sua barbearia para gerar e assinar o contrato."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/admin/config#contrato"
          className="whitespace-nowrap rounded-md bg-accent px-3.5 py-2 text-caption font-bold text-text-inverse hover:bg-accent-hover"
        >
          {dataComplete ? "Assinar agora" : "Preencher agora"}
        </Link>
        <button type="button" onClick={dismiss} aria-label="Dispensar" className="text-text-muted hover:text-text">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

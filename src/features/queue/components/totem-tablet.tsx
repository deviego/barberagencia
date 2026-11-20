"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateTotemToken } from "../totem-actions";

/**
 * Bloco "Totem — só no tablet" (#102). Acesso secreto do totem, separado do QR do cliente:
 * é para abrir no tablet do balcão, nunca para imprimir nem colar na parede.
 * Só aparece com o modo da fila em Totem ou Ambos.
 */
export function TotemTablet({ totemUrl, qrDataUrl }: { totemUrl: string; qrDataUrl: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function regenerate() {
    setMsg(null);
    startTransition(async () => {
      const res = await regenerateTotemToken();
      setMsg(res.ok ? "Novo link gerado — o antigo parou de funcionar." : res.error ?? "Falha.");
      router.refresh();
    });
  }

  function copy() {
    navigator.clipboard?.writeText(totemUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="totem">
      <div className="flex items-center gap-2">
        <Tablet size={16} className="text-text-muted" aria-hidden />
        <h2 className="text-overline uppercase text-text-muted">Totem — só no tablet</h2>
      </div>
      <p className="flex items-start gap-2 text-caption text-warning-strong">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        Abra este acesso só no tablet do balcão. Não imprima nem cole na parede.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR do totem" className="h-28 w-28 shrink-0 rounded-md border border-border" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-inset px-3 py-2">
            <span className="flex-1 truncate text-caption text-text tabular">{totemUrl}</span>
            <button
              type="button"
              onClick={copy}
              className="flex min-h-11 shrink-0 items-center gap-1 text-caption font-semibold text-accent hover:underline"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={totemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-1.5 text-caption font-semibold text-accent hover:underline"
            >
              Abrir totem <ExternalLink size={13} aria-hidden />
            </a>
            <Button variant="outline" size="sm" onClick={regenerate} disabled={pending}>
              <RefreshCw size={13} aria-hidden /> Regenerar link
            </Button>
            {msg && <span className="text-caption text-text-muted">{msg}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

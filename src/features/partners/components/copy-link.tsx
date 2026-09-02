"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Botão compacto para copiar um texto (ex.: link de afiliado). */
export function CopyLink({ value, label = "Copiar link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-caption font-semibold text-accent hover:underline">
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : label}
    </button>
  );
}

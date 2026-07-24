"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MESSAGE_TEMPLATES, fillTemplate } from "@/features/messages/templates";
import { SUPPORT_WHATSAPP } from "@/lib/contact";

const WHATSAPP_NUMBER = SUPPORT_WHATSAPP;

export function MessageTemplatesList() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {MESSAGE_TEMPLATES.map((t) => {
        const filled = fillTemplate(t.body, {});
        return (
          <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-body font-semibold text-text">{t.title}</span>
                <Badge variant={t.channel === "whatsapp" ? "success" : "neutral"}>
                  {t.channel === "whatsapp" ? "WhatsApp" : "In-app"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copy(t.id, filled)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
                >
                  {copied === t.id ? <Check size={14} /> : <Copy size={14} />}
                  {copied === t.id ? "Copiado" : "Copiar"}
                </button>
                {t.channel === "whatsapp" && (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(filled)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-semibold text-white"
                    style={{ background: "#25D366" }}
                  >
                    <MessageCircle size={14} />
                    Abrir
                  </a>
                )}
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-inset p-3 font-ui text-caption leading-relaxed text-text-2">
              {filled}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, MonitorSmartphone, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setQueueMode, setQueuePlanRequiresService, regenerateTotemToken } from "../totem-actions";

type Mode = "TOTEM" | "APP" | "BOTH";

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: "TOTEM", label: "Totem", desc: "Senha pelo totem (identifica por telefone)" },
  { key: "APP", label: "App / QR", desc: "Cliente pega a senha pelo próprio celular" },
  { key: "BOTH", label: "Ambos", desc: "Totem e app disponíveis" },
];

/** Seção "Fila / Totem" nas Configurações do admin. */
export function TotemConfig({
  totemUrl,
  qrDataUrl,
  mode: initialMode,
  planRequiresService,
}: {
  totemUrl: string;
  qrDataUrl: string;
  mode: Mode;
  planRequiresService: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function changeMode(m: Mode) {
    setMode(m);
    startTransition(async () => {
      await setQueueMode(m);
    });
  }
  function togglePlan(v: boolean) {
    startTransition(async () => {
      await setQueuePlanRequiresService(v);
    });
  }
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

  const showTotem = mode === "TOTEM" || mode === "BOTH";

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="totem">
      <div className="flex items-center gap-2">
        <MonitorSmartphone size={16} className="text-text-muted" />
        <div className="text-overline uppercase text-text-muted">Fila / Totem</div>
      </div>

      {/* Modo da fila */}
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-text-2">Como os clientes entram na fila</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => changeMode(m.key)}
              disabled={pending}
              className={`flex flex-col gap-0.5 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                mode === m.key ? "border-accent bg-accent-wash" : "border-border hover:border-accent"
              }`}
            >
              <span className="text-body font-semibold text-text">{m.label}</span>
              <span className="text-caption text-text-muted">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Flag: plano também escolhe serviço */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <div>
          <div className="text-body font-semibold text-text">Cliente de plano também escolhe serviço</div>
          <div className="text-caption text-text-muted">Se desligado, o cliente com plano pula a escolha de serviço no totem.</div>
        </div>
        <Switch defaultChecked={planRequiresService} onChange={togglePlan} />
      </div>

      {/* Link + QR do totem */}
      {showTotem && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <span className="text-caption font-semibold text-text-2">Link do totem</span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR do totem" className="h-36 w-36 shrink-0 rounded-md border border-border" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-caption text-text-2">
                Abra este link (ou leia o QR) no dispositivo do totem, em tela cheia. É um link secreto — não divulgue.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-inset px-3 py-2">
                <span className="flex-1 truncate text-caption text-text tabular">{totemUrl}</span>
                <button onClick={copy} className="flex shrink-0 items-center gap-1 text-caption font-semibold text-accent hover:underline">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a href={totemUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline">
                  Abrir totem <ExternalLink size={13} />
                </a>
                <Button variant="outline" size="sm" onClick={regenerate} disabled={pending}>
                  <RefreshCw size={13} /> Regenerar link
                </Button>
                {msg && <span className="text-caption text-text-muted">{msg}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "APP" && (
        <Badge variant="neutral">Totem desativado — clientes usam o app/QR pelo celular.</Badge>
      )}
    </section>
  );
}

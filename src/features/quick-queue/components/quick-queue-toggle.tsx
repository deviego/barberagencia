"use client";

import { useId } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";

/**
 * Liga/desliga da fila rápida no painel (#102). Só aparece com a fila no plano e ligada.
 * O mesmo QR e o mesmo link do cliente servem nos dois estados: ligada abre a fila rápida,
 * desligada abre a fila com login.
 * TODO(#102): ligar à ação do Engrenagem. Até lá o interruptor mostra o estado salvo e fica
 * travado, para não parecer que mudou sem salvar.
 */
export function QuickQueueToggle({
  enabled,
  whatsappDisconnected,
}: {
  enabled: boolean;
  /** true só quando o gateway respondeu e o WhatsApp não está conectado (sem resposta: sem aviso). */
  whatsappDisconnected: boolean;
}) {
  const labelId = useId();
  const descId = useId();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="fila-rapida">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div id={labelId} className="flex items-center gap-2 text-body font-semibold text-text">
            <Zap size={16} className="shrink-0 text-accent" aria-hidden />
            Fila rápida
          </div>
          <p id={descId} className="mt-1 text-caption text-text-2">
            {enabled
              ? "Ligada: o cliente entra na fila só com o telefone."
              : "Desligada: o cliente precisa entrar na conta para pegar senha."}
          </p>
        </div>
        <Switch defaultChecked={enabled} disabled aria-labelledby={labelId} aria-describedby={descId} />
      </div>

      {whatsappDisconnected && (
        <p role="status" className="flex items-start gap-2 text-caption text-warning-strong">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          WhatsApp desconectado. A fila funciona normal, só a mensagem de acesso não sai.
        </p>
      )}
    </section>
  );
}

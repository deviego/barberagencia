"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { setQuickQueueEnabled } from "../admin-actions";
import { QUICK_QUEUE_ADMIN_MESSAGES as MSG } from "../types";

/**
 * Liga/desliga da fila rápida no painel (#102). Só aparece com a fila no plano e ligada.
 * O mesmo QR e o mesmo link do cliente servem nos dois estados: ligada abre a fila rápida,
 * desligada abre a fila com login.
 * Salva com setQuickQueueEnabled (a barbearia vem da sessão; vai só true/false). A ação revalida
 * /admin/config: o cartaz A aparece ou some na hora. Em erro, o interruptor volta ao estado salvo.
 * Alerta ao dono (condição da Navalha): no topo do bloco, com "Desligar fila rápida" e confirmação.
 */
export function QuickQueueToggle({
  enabled,
  whatsappDisconnected,
  alert = null,
}: {
  enabled: boolean;
  /** Alerta do dia (quickQueueLimitAlert): CAP = teto atingido; HIGH = total alto; null = nada. */
  alert?: { kind: "CAP" | "HIGH"; total: number } | null;
  /** true só quando o gateway respondeu e o WhatsApp não está conectado (sem resposta: sem aviso). */
  whatsappDisconnected: boolean;
}) {
  const labelId = useId();
  const descId = useId();
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  // Trava síncrona: dois toques seguidos não mandam dois pedidos.
  const inFlight = useRef(false);

  // Estado salvo que chega do servidor depois da revalidação.
  useEffect(() => setOn(enabled), [enabled]);

  function change(next: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setNotice(null);
    setOn(next);
    startTransition(async () => {
      try {
        const res = await setQuickQueueEnabled(next);
        if (res.ok) {
          setOn(res.enabled);
          if (!res.enabled) setNotice(MSG.turnedOff);
        } else {
          setOn(!next);
          setError(res.error);
        }
      } catch {
        setOn(!next);
        setError(MSG.failed);
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" id="fila-rapida">
      {on && alert && (
        <div role="status" className="flex flex-col gap-3 rounded-md border border-warning-strong p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-strong" aria-hidden />
            <div className="min-w-0">
              <p className="text-body font-semibold text-text">{MSG.alertTitle(alert.total)}</p>
              <p className="mt-1 text-caption text-text-2">
                {alert.kind === "CAP" ? MSG.alertBodyCap : MSG.alertBodyHigh}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-fit"
            loading={pending}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {MSG.alertAction}
          </Button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div id={labelId} className="flex items-center gap-2 text-body font-semibold text-text">
            <Zap size={16} className="shrink-0 text-accent" aria-hidden />
            {MSG.label}
          </div>
          <p id={descId} className="mt-1 text-caption text-text-2">
            {on ? MSG.on : MSG.off}
          </p>
        </div>
        <Switch
          checked={on}
          onChange={change}
          disabled={pending}
          aria-labelledby={labelId}
          aria-describedby={descId}
        />
      </div>

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
      {notice && !on && (
        <p role="status" className="text-caption text-text-2">
          {notice}
        </p>
      )}

      {whatsappDisconnected && (
        <p role="status" className="flex items-start gap-2 text-caption text-warning-strong">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {MSG.whatsappOff}
        </p>
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={MSG.confirmTitle}
        message={MSG.confirmBody}
        confirmLabel={MSG.confirmYes}
        cancelLabel={MSG.confirmNo}
        danger
        onConfirm={() => change(false)}
      />
    </section>
  );
}

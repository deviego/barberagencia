"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { QUICK_QUEUE_ADMIN_MESSAGES as ADMIN, QUICK_QUEUE_ONBOARDING_MESSAGES as MSG } from "../types";

/**
 * Ação de renovar a chave do totem. Vem de fora (a página passa regenerateTotemToken): o módulo da
 * fila rápida não importa nada do totem (regra do test-quick-queue-guard).
 */
export type RotateTotemKey = () => Promise<{ ok: boolean }>;

/**
 * Renovar a chave do totem com confirmação (#103). A ação revalida /admin/config: o bloco
 * "Totem — só no tablet" já mostra o novo acesso. Devolve o estado para o passo a passo e o lembrete.
 */
function useRotateKey(rotateKey: RotateTotemKey, onRotated: () => void) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function rotate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const res = await rotateKey();
        if (res.ok) onRotated();
        else setError(ADMIN.failed);
      } catch {
        setError(ADMIN.failed);
      } finally {
        inFlight.current = false;
      }
    });
  }

  const modal = (
    <ConfirmModal
      open={confirming}
      onClose={() => setConfirming(false)}
      title={MSG.rotate}
      message={MSG.confirm}
      confirmLabel={MSG.rotate}
      cancelLabel={ADMIN.confirmNo}
      onConfirm={rotate}
    />
  );
  return { ask: () => setConfirming(true), pending, error, modal };
}

/**
 * Passo a passo "Antes de começar" (#103). Aparece quando ligar a fila rápida volta ROTATE_FIRST:
 * a fila rápida segue desligada até a chave do totem ser renovada.
 * Depois de renovar, o passo 1 fica marcado e os passos 2 e 3 continuam como orientação.
 */
export function QuickQueueOnboarding({
  rotateKey,
  rotated,
  onRotated,
  onLater,
}: {
  rotateKey: RotateTotemKey;
  rotated: boolean;
  onRotated: () => void;
  onLater: () => void;
}) {
  const { ask, pending, error, modal } = useRotateKey(rotateKey, onRotated);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-accent p-4">
      <h3 className="flex items-center gap-2 text-body font-semibold text-text">
        <KeyRound size={18} className="shrink-0 text-accent" aria-hidden />
        {MSG.title}
      </h3>
      <ol className="flex flex-col gap-2">
        {MSG.steps.map((step, i) => (
          <li key={step} className="flex items-start gap-2 text-body text-text-2">
            {/* Os passos já vêm numerados no texto; só o passo feito ganha o ✓. */}
            {i === 0 && rotated && <Check size={16} className="mt-1 shrink-0 text-success" aria-hidden />}
            <span className={i === 0 && rotated ? "text-text-muted line-through" : undefined}>{step}</span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}

      {!rotated && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={ask} loading={pending} disabled={pending} className="w-full sm:w-fit">
            {MSG.rotate}
          </Button>
          <Button type="button" variant="ghost" onClick={onLater} disabled={pending} className="w-full sm:w-fit">
            {MSG.later}
          </Button>
        </div>
      )}
      {modal}
    </div>
  );
}

/** Lembrete na área da fila até a chave do totem ser renovada (#103, "Fazer depois"). */
export function QuickQueueRotateReminder({
  rotateKey,
  onRotated,
}: {
  rotateKey: RotateTotemKey;
  onRotated: () => void;
}) {
  const { ask, pending, error, modal } = useRotateKey(rotateKey, onRotated);
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="flex items-start gap-2 text-caption text-warning-strong">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {MSG.reminder}
      </p>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={ask} loading={pending} disabled={pending} className="w-fit">
        {MSG.rotate}
      </Button>
      {modal}
    </div>
  );
}

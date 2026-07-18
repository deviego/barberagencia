"use client";

import { AlertTriangle } from "lucide-react";

export function CancelRefundModal({
  open,
  onClose,
  isPlan,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  isPlan: boolean;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="w-[420px] max-w-full rounded-lg border border-border bg-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg">
            <AlertTriangle size={20} className="text-danger-strong" />
          </span>
          <h3 className="text-h4 font-semibold text-text">Cancelar agendamento?</h3>
        </div>
        <div className="flex flex-col gap-2 text-body text-text-2">
          {isPlan ? (
            <p>
              Este corte <strong className="text-text">volta ao seu saldo na hora</strong> — você
              fica com 4/4 cortes neste mês.
            </p>
          ) : (
            <p>
              O valor pago será <strong className="text-text">estornado em até 5 dias úteis</strong>{" "}
              no mesmo meio de pagamento.
            </p>
          )}
          <p className="text-caption text-text-muted">
            Cancelamentos até 2h antes do horário têm reembolso integral.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-body text-text transition-colors hover:border-accent"
          >
            Voltar
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-md bg-danger px-4 py-2 text-body font-bold text-white transition-colors hover:bg-danger-strong"
          >
            Cancelar agendamento
          </button>
        </div>
      </div>
    </div>
  );
}

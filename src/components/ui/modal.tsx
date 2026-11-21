"use client";

import { useEffect, useId } from "react";

/** Modal de confirmação centralizado. Esc ou toque fora fecham; o foco começa em "Voltar". */
export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  danger,
  cancelLabel = "Voltar",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
  cancelLabel?: string;
}) {
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="w-[400px] max-w-full rounded-lg border border-border bg-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-h4 font-semibold text-text">
          {title}
        </h3>
        <p id={messageId} className="mt-2 text-body text-text-2">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="min-h-11 rounded-md border border-border px-4 py-2 text-body text-text transition-colors hover:border-accent"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`min-h-11 rounded-md px-4 py-2 text-body font-bold text-white transition-colors ${
              danger ? "bg-danger hover:bg-danger-strong" : "bg-accent hover:bg-accent-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

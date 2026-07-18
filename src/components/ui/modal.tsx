"use client";

/** Modal de confirmação centralizado. */
export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="w-[400px] max-w-full rounded-lg border border-border bg-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-h4 font-semibold text-text">{title}</h3>
        <p className="mt-2 text-body text-text-2">{message}</p>
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
            className={`rounded-md px-4 py-2 text-body font-bold text-white transition-colors ${
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

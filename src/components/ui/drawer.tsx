"use client";

import { X } from "lucide-react";

/** Drawer lateral (direita) — usado para cadastros/detalhes. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-drawer flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-[400px] max-w-full flex-col border-l border-border bg-elevated shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-h4 font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="text-text-muted transition-colors hover:text-accent">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}

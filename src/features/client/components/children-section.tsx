"use client";

import { useState, useTransition } from "react";
import { Baby, Plus, Trash2 } from "lucide-react";
import { ChildModal, type Child } from "./child-modal";
import { removeChild } from "@/features/client/actions";

/** Seção do perfil para gerenciar as crianças (filhos) do cliente. */
export function ChildrenSection({ initial }: { initial: Child[] }) {
  const [children, setChildren] = useState<Child[]>(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeChild(id);
      if (res.ok) setChildren((c) => c.filter((x) => x.id !== id));
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-overline uppercase text-text-muted">
          <Baby size={14} /> Minhas crianças
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-caption font-semibold text-accent hover:underline"
        >
          <Plus size={14} /> Registrar
        </button>
      </div>

      {children.length === 0 ? (
        <p className="text-caption text-text-muted">
          Nenhuma criança cadastrada. Registre para agendar o corte infantil.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {children.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-md border border-border-subtle p-3">
              {c.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt={c.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-inset text-accent">
                  <Baby size={18} />
                </span>
              )}
              <div className="flex-1">
                <div className="text-body font-semibold text-text">{c.name}</div>
                {c.age != null && <div className="text-caption text-text-muted">{c.age} anos</div>}
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={pending}
                aria-label="Remover"
                className="text-text-muted transition-colors hover:text-danger disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ChildModal open={open} onClose={() => setOpen(false)} onSaved={(c) => setChildren((cur) => [...cur, c])} />
    </section>
  );
}

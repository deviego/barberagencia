"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, LogOut, Search } from "lucide-react";
import { setActingTenant } from "@/features/platform/actions";
import { cn } from "@/lib/utils";

/** Seletor de barbearia para o super-admin (MASTER): "atuar como" qualquer barbearia. */
export function BarbershopSwitcher({
  tenants,
  currentName,
  acting,
}: {
  tenants: { id: string; name: string }[];
  currentName: string;
  acting: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shortName = currentName.replace(/^Barbearia\s+/i, "");
  const filtered = q
    ? tenants.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
    : tenants;

  function pick(id: string | null) {
    startTransition(async () => {
      await setActingTenant(id);
      setOpen(false);
      setQ("");
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={cn(
          "hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-caption transition-colors sm:flex",
          acting ? "border-accent bg-accent-wash text-accent" : "border-border text-text hover:border-accent"
        )}
      >
        <Building2 size={15} className="text-accent" />
        <span className="max-w-[160px] truncate">{shortName}</span>
        {acting && <span className="rounded-pill bg-accent px-1.5 text-[10px] font-bold uppercase text-text-inverse">atuando</span>}
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-modal mt-1 w-72 overflow-hidden rounded-lg border border-border bg-elevated shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={14} className="text-text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar barbearia…"
              className="w-full bg-transparent text-caption text-text placeholder:text-text-muted focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-3 text-caption text-text-muted">Nenhuma barbearia.</p>}
            {filtered.map((t) => {
              const active = t.name.replace(/^Barbearia\s+/i, "") === shortName;
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t.id)}
                  disabled={pending}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-caption transition-colors hover:bg-accent-wash",
                    active ? "font-semibold text-accent" : "text-text-2"
                  )}
                >
                  <Building2 size={14} className="shrink-0 text-text-muted" />
                  <span className="flex-1 truncate">{t.name}</span>
                  {active && <Check size={14} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
          {acting && (
            <button
              onClick={() => pick(null)}
              disabled={pending}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-caption font-semibold text-text-2 transition-colors hover:bg-accent-wash hover:text-accent"
            >
              <LogOut size={14} /> Sair do modo atuar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

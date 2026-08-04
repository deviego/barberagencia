"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskPhoneBR } from "@/lib/masks";
import { createClientAdmin } from "@/features/admin/actions";

interface Opt {
  id: string;
  name: string;
}

const inputCls =
  "w-full rounded-md border border-border bg-inset px-3 py-2 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none";

/** Busca de cliente com opção de criar na hora (rápido só nome, ou completo). */
export function ClientPicker({
  clients,
  value,
  onChange,
  noneLabel,
  placeholder = "Buscar cliente pelo nome…",
}: {
  clients: Opt[];
  value: string;
  onChange: (id: string, name: string) => void;
  /** Se definido, o vazio significa "sem cliente" (ex.: venda de balcão). */
  noneLabel?: string;
  placeholder?: string;
}) {
  const [extra, setExtra] = useState<Opt[]>([]);
  const all = useMemo(() => {
    const m = new Map<string, Opt>();
    for (const c of [...clients, ...extra]) m.set(c.id, m.get(c.id) ?? c);
    return [...m.values()];
  }, [clients, extra]);
  const selected = all.find((c) => c.id === value) ?? null;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [nName, setNName] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  const q = query.trim();
  const filtered = all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  function pick(c: Opt) {
    onChange(c.id, c.name);
    setQuery("");
    setOpen(false);
    setShowFull(false);
  }
  function created(c: Opt) {
    setExtra((p) => (p.some((x) => x.id === c.id) ? p : [...p, c]));
    pick(c);
    setNName("");
    setNPhone("");
    setNEmail("");
    setErr(null);
  }
  function createSimple() {
    if (!q) return;
    setErr(null);
    startCreate(async () => {
      const res = await createClientAdmin({ name: q });
      if (res.ok) created(res.client);
      else setErr(res.error);
    });
  }
  function createFull() {
    const nm = (nName || q).trim();
    if (!nm) return setErr("Informe o nome do cliente.");
    setErr(null);
    startCreate(async () => {
      const res = await createClientAdmin({ name: nm, phone: nPhone || undefined, email: nEmail || undefined });
      if (res.ok) created(res.client);
      else setErr(res.error);
    });
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-inset px-3 py-2">
        <span className="text-body text-text">{selected.name}</span>
        <button type="button" onClick={() => onChange("", "")} className="text-caption font-medium text-text-muted hover:text-accent">
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputCls}
      />
      {noneLabel && !q && <p className="mt-1 text-caption text-text-muted">Deixe em branco para {noneLabel.toLowerCase()}.</p>}
      {open && q && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="block w-full px-3 py-2.5 text-left text-body text-text transition-colors hover:bg-accent-wash"
                >
                  {c.name}
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-caption text-text-muted">Nenhum cliente encontrado.</p>
            )}
            {/* Criar cliente — sempre disponível (por último), permite nome repetido */}
            <div className="flex flex-col gap-2 border-t border-border-subtle p-2">
              <button
                type="button"
                onClick={createSimple}
                disabled={creating}
                className="flex items-center gap-2 rounded-md border border-accent bg-accent-wash px-3 py-2 text-left text-body font-semibold text-accent transition-colors hover:brightness-95 disabled:opacity-60"
              >
                <Plus size={15} /> Criar “{q}” (novo cliente)
              </button>
              {!showFull ? (
                <button
                  type="button"
                  onClick={() => {
                    setNName(q);
                    setShowFull(true);
                  }}
                  className="self-start px-1 text-caption font-medium text-text-2 hover:text-accent"
                >
                  + Cadastro completo (nome, telefone, e-mail)
                </button>
              ) : (
                <div className="flex flex-col gap-2 border-t border-border-subtle pt-2">
                  <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nome completo" className={inputCls} />
                  <input
                    value={nPhone}
                    onChange={(e) => setNPhone(maskPhoneBR(e.target.value))}
                    inputMode="tel"
                    maxLength={15}
                    placeholder="Telefone (opcional)"
                    className={inputCls}
                  />
                  <input value={nEmail} onChange={(e) => setNEmail(e.target.value)} type="email" placeholder="E-mail (opcional)" className={inputCls} />
                  <Button size="sm" loading={creating} onClick={createFull}>
                    Criar cliente
                  </Button>
                </div>
              )}
              {err && <p className="px-1 text-caption text-danger">{err}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addScheduleBlock, removeScheduleBlock } from "@/features/admin/actions";

interface Block {
  id: string;
  barberName: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

const fieldCls =
  "h-9 rounded-md border border-border bg-inset px-2 text-body text-text focus:border-accent focus:outline-none";

export function ScheduleBlocksPanel({ barbers, blocks }: { barbers: { id: string; name: string }[]; blocks: Block[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!date) return setError("Escolha a data.");
    const startsAt = new Date(`${date}T${allDay ? "00:00" : start}:00`);
    const endsAt = new Date(`${date}T${allDay ? "23:59" : end}:00`);
    if (endsAt <= startsAt) return setError("O fim precisa ser maior que o início.");
    startTransition(async () => {
      const res = await addScheduleBlock({
        barberId: barberId || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: reason || null,
      });
      if (res.ok) {
        setDate("");
        setReason("");
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeScheduleBlock(id);
      router.refresh();
    });
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-accent" />
          <h2 className="text-h5 font-bold text-text">Bloqueios / Folgas</h2>
        </div>
        <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen((o) => !o)}>
          {open ? <><X size={14} /> Fechar</> : <><Plus size={14} /> Novo bloqueio</>}
        </Button>
      </div>
      <p className="text-caption text-text-muted">Trave dias ou horários (feriado, folga, almoço extra). Nesses períodos a agenda não aceita marcação.</p>

      {open && (
        <div className="flex flex-col gap-3 rounded-md border border-border-subtle p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select className={fieldCls} value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">Toda a barbearia</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="flex items-center gap-1.5 text-caption text-text-2">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Dia inteiro
            </label>
            {!allDay && (
              <>
                <input type="time" className={fieldCls} value={start} onChange={(e) => setStart(e.target.value)} />
                <span className="text-text-muted">–</span>
                <input type="time" className={fieldCls} value={end} onChange={(e) => setEnd(e.target.value)} />
              </>
            )}
          </div>
          <input
            className={`${fieldCls} w-full`}
            placeholder="Motivo (opcional) — ex.: feriado, folga"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <p className="text-caption text-danger">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" loading={pending} onClick={submit}>Bloquear</Button>
          </div>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-caption text-text-muted">Nenhum bloqueio ativo.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2">
              <div className="min-w-0">
                <div className="text-body text-text tabular">{fmt(b.startsAt)} → {fmt(b.endsAt)}</div>
                <div className="text-caption text-text-muted">
                  {b.barberName ?? "Toda a barbearia"}{b.reason ? ` · ${b.reason}` : ""}
                </div>
              </div>
              <button
                onClick={() => remove(b.id)}
                disabled={pending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-danger-bg hover:text-danger-strong disabled:opacity-40"
                aria-label="Remover bloqueio"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

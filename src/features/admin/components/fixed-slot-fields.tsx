"use client";

import { Label } from "@/components/ui/input";

export interface FixedSlot {
  weekday: number; // 0=domingo … 6=sábado
  time: string; // "HH:MM"
  barberId: string;
  serviceId: string;
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

const selectCls =
  "h-10 rounded-md border border-border bg-inset px-3 text-body text-text focus-visible:border-focus focus-visible:outline-none";

interface Opt {
  id: string;
  name: string;
}

/** Campos do slot fixo semanal (dia/horário/barbeiro/serviço) — usado ao ativar plano fixo. */
export function FixedSlotFields({
  barbers,
  services,
  value,
  onChange,
}: {
  barbers: Opt[];
  services: Opt[];
  value: FixedSlot;
  onChange: (v: FixedSlot) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-warning bg-warning-bg/40 p-3">
      <p className="text-caption text-text-2">
        Plano de <strong>horário fixo</strong>: defina o dia, horário e barbeiro. O sistema já reserva os cortes semanais.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Dia da semana</Label>
          <select value={value.weekday} onChange={(e) => onChange({ ...value, weekday: Number(e.target.value) })} className={selectCls}>
            {WEEKDAYS.map((w, i) => (
              <option key={i} value={i}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Horário</Label>
          <input type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} className={selectCls} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Barbeiro</Label>
        <select value={value.barberId} onChange={(e) => onChange({ ...value, barberId: e.target.value })} className={selectCls}>
          <option value="">Selecione…</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Serviço do corte</Label>
        <select value={value.serviceId} onChange={(e) => onChange({ ...value, serviceId: e.target.value })} className={selectCls}>
          <option value="">Selecione…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

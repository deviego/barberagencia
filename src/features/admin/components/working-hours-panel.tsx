"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Drawer } from "@/components/ui/drawer";
import { Label } from "@/components/ui/input";
import { saveWorkingHours } from "@/features/admin/actions";

interface Barber { id: string; name: string; active: boolean }
interface WH { barber_id: string; weekday: number; start_min: number; end_min: number }

const DAYS = [
  { wd: 1, label: "Segunda", abbr: "Seg" },
  { wd: 2, label: "Terça", abbr: "Ter" },
  { wd: 3, label: "Quarta", abbr: "Qua" },
  { wd: 4, label: "Quinta", abbr: "Qui" },
  { wd: 5, label: "Sexta", abbr: "Sex" },
  { wd: 6, label: "Sábado", abbr: "Sáb" },
  { wd: 0, label: "Domingo", abbr: "Dom" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const minToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface DayState {
  enabled: boolean;
  start: string;
  end: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

const timeCls =
  "h-9 flex-1 rounded-md border border-border bg-inset px-2 text-body text-text focus:border-accent focus:outline-none disabled:opacity-40";

function WorkingHoursEditor({
  barber,
  hours,
  onDone,
}: {
  barber: Barber;
  hours: WH[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState<Record<number, DayState>>(() => {
    const map: Record<number, DayState> = {};
    for (const d of DAYS) {
      const rows = hours.filter((h) => h.weekday === d.wd).sort((a, b) => a.start_min - b.start_min);
      const defaults = { hasBreak: false, breakStart: "12:00", breakEnd: "13:00" };
      if (rows.length === 0) {
        map[d.wd] = { enabled: false, start: "09:00", end: "18:00", ...defaults };
      } else if (rows.length === 1) {
        map[d.wd] = { enabled: true, start: minToTime(rows[0].start_min), end: minToTime(rows[0].end_min), ...defaults };
      } else {
        // 2+ janelas = expediente com intervalo (a lacuna entre a 1ª e a 2ª).
        map[d.wd] = {
          enabled: true,
          start: minToTime(rows[0].start_min),
          end: minToTime(rows[rows.length - 1].end_min),
          hasBreak: true,
          breakStart: minToTime(rows[0].end_min),
          breakEnd: minToTime(rows[1].start_min),
        };
      }
    }
    return map;
  });

  function set(wd: number, patch: Partial<DayState>) {
    setDays((s) => ({ ...s, [wd]: { ...s[wd], ...patch } }));
  }

  function save() {
    setError(null);
    const entries: { weekday: number; startMin: number; endMin: number }[] = [];
    for (const d of DAYS) {
      const st = days[d.wd];
      if (!st.enabled) continue;
      const s = timeToMin(st.start);
      const e = timeToMin(st.end);
      if (e <= s) {
        setError("Em cada dia, o fim precisa ser maior que o início.");
        return;
      }
      if (st.hasBreak) {
        const bs = timeToMin(st.breakStart);
        const be = timeToMin(st.breakEnd);
        if (!(s < bs && bs < be && be < e)) {
          setError("O intervalo precisa ficar dentro do expediente (início < intervalo < fim).");
          return;
        }
        entries.push({ weekday: d.wd, startMin: s, endMin: bs });
        entries.push({ weekday: d.wd, startMin: be, endMin: e });
      } else {
        entries.push({ weekday: d.wd, startMin: s, endMin: e });
      }
    }
    startTransition(async () => {
      const res = await saveWorkingHours(barber.id, entries);
      if (res.ok) {
        onDone();
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-text-muted">
        Marque os dias e defina o horário. Sem horários, o barbeiro não aparece na disponibilidade de
        agendamento.
      </p>
      {DAYS.map((d) => {
        const st = days[d.wd];
        return (
          <div key={d.wd} className="flex flex-col gap-2 rounded-md border border-border-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex w-24 items-center gap-2">
                <Switch defaultChecked={st.enabled} onChange={(v) => set(d.wd, { enabled: v })} />
                <span className="text-body text-text">{d.abbr}</span>
              </div>
              <input
                type="time"
                value={st.start}
                disabled={!st.enabled}
                onChange={(e) => set(d.wd, { start: e.target.value })}
                className={timeCls}
              />
              <span className="text-text-muted">–</span>
              <input
                type="time"
                value={st.end}
                disabled={!st.enabled}
                onChange={(e) => set(d.wd, { end: e.target.value })}
                className={timeCls}
              />
            </div>
            {st.enabled && (
              <div className="flex items-center gap-2 pl-[104px]">
                <label className="flex shrink-0 items-center gap-1.5 text-caption text-text-2">
                  <Switch defaultChecked={st.hasBreak} onChange={(v) => set(d.wd, { hasBreak: v })} /> Intervalo
                </label>
                {st.hasBreak && (
                  <>
                    <input type="time" value={st.breakStart} onChange={(e) => set(d.wd, { breakStart: e.target.value })} className={timeCls} />
                    <span className="text-text-muted">–</span>
                    <input type="time" value={st.breakEnd} onChange={(e) => set(d.wd, { breakEnd: e.target.value })} className={timeCls} />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-caption text-danger">{error}</p>}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button loading={pending} onClick={save}>
          Salvar horários
        </Button>
      </div>
    </div>
  );
}

export function WorkingHoursPanel({ barbers, workingHours }: { barbers: Barber[]; workingHours: WH[] }) {
  const [selected, setSelected] = useState<Barber | null>(null);
  const byBarber = useMemo(() => {
    const map: Record<string, WH[]> = {};
    for (const h of workingHours) (map[h.barber_id] ??= []).push(h);
    return map;
  }, [workingHours]);

  const active = barbers.filter((b) => b.active !== false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-accent" />
        <h2 className="text-h5 font-bold text-text">Horários de trabalho</h2>
      </div>
      <p className="text-caption text-text-muted">
        Define a disponibilidade de cada barbeiro no agendamento.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {active.map((b) => {
          const hs = (byBarber[b.id] ?? []).slice().sort((x, y) => x.weekday - y.weekday);
          const enabledAbbrs = DAYS.filter((d) => hs.some((h) => h.weekday === d.wd)).map((d) => d.abbr);
          return (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
              <div className="min-w-0">
                <div className="text-body font-semibold text-text">{b.name}</div>
                {enabledAbbrs.length ? (
                  <div className="text-caption text-text-muted">{enabledAbbrs.join(" · ")}</div>
                ) : (
                  <div className="text-caption text-warning-strong">Sem horários — não aparece na agenda</div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelected(b)}>
                Editar
              </Button>
            </div>
          );
        })}
        {active.length === 0 && <p className="text-caption text-text-muted">Nenhum barbeiro ativo.</p>}
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Horários · ${selected.name}` : "Horários"}
      >
        {selected && (
          <WorkingHoursEditor
            key={selected.id}
            barber={selected}
            hours={byBarber[selected.id] ?? []}
            onDone={() => setSelected(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

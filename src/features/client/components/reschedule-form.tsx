"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { rescheduleAppointment } from "@/features/client/actions";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_MIN = 45;

interface WorkingHour { barber_id: string; weekday: number; start_min: number; end_min: number }

export function RescheduleForm({
  appointmentId,
  barberId,
  barberName,
  serviceName,
  currentStartAt,
  workingHours,
}: {
  appointmentId: string;
  barberId: string | null;
  barberName: string;
  serviceName: string;
  currentStartAt: string;
  workingHours: WorkingHour[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<number[]>([]);

  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return { idx: i, wd: WEEKDAYS[d.getDay()], dd: d.getDate(), date: d };
    });
  }, []);

  const slots = useMemo(() => {
    const day = days[dayIdx]?.date;
    if (!day || !barberId) return [];
    const wd = day.getDay();
    const now = new Date();
    const isToday = day.toDateString() === now.toDateString();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const out: string[] = [];
    for (const w of workingHours.filter((x) => x.barber_id === barberId && x.weekday === wd)) {
      for (let t = w.start_min; t + SLOT_MIN <= w.end_min; t += SLOT_MIN) {
        if (isToday && t <= nowMin) continue; // já passou hoje
        out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      }
    }
    return out.sort();
  }, [days, dayIdx, barberId, workingHours]);

  // Horários já ocupados do barbeiro no dia selecionado (exceto o próprio agendamento).
  useEffect(() => {
    const day = days[dayIdx]?.date;
    if (!day || !barberId) {
      setBooked([]);
      return;
    }
    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const ownTime = new Date(currentStartAt).getTime();
    const supabase = createSupabaseBrowserClient();
    let alive = true;
    supabase
      .rpc("booked_starts", { p_barber_id: barberId, p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => {
        if (!alive) return;
        const times = ((data as string[]) ?? [])
          .map((s) => new Date(s).getTime())
          .filter((t) => t !== ownTime);
        setBooked(times);
      });
    return () => {
      alive = false;
    };
  }, [days, dayIdx, barberId, currentStartAt]);

  function isBooked(t: string) {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    return booked.includes(d.getTime());
  }

  function submit() {
    setError(null);
    if (!time) return;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    startTransition(async () => {
      const res = await rescheduleAppointment(appointmentId, d.toISOString());
      if (res.ok) router.push("/agendamentos");
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-inset text-accent">
          <CalendarClock size={16} />
        </span>
        <div className="text-body font-semibold text-text">
          {serviceName} · {barberName}
        </div>
      </div>

      {/* Dia */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Nova data</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.idx}
              onClick={() => {
                setDayIdx(d.idx);
                setTime(null);
              }}
              className={cn(
                "flex min-w-[52px] flex-col items-center rounded-md border px-3 py-2 transition-colors tabular",
                dayIdx === d.idx ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
              )}
            >
              <span className="text-caption">{d.wd}</span>
              <span className="text-h5 font-bold">{d.dd}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Horário */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Novo horário</div>
        {slots.length === 0 ? (
          <p className="text-caption text-text-muted">
            Sem horários para este barbeiro neste dia. Escolha outro dia.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((t) => {
              const occupied = isBooked(t);
              return (
                <button
                  key={t}
                  disabled={occupied}
                  onClick={() => setTime(t)}
                  className={cn(
                    "rounded-md border py-2 text-body tabular transition-colors",
                    occupied
                      ? "cursor-not-allowed border-border-subtle text-text-muted line-through opacity-60"
                      : time === t
                        ? "border-2 border-accent bg-accent-wash text-accent"
                        : "border-border text-text hover:border-accent"
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {error && <p className="text-caption text-danger">{error}</p>}

      <div className="sticky bottom-24 md:bottom-4">
        <Button size="lg" className="w-full" loading={pending} disabled={!time} onClick={submit}>
          Confirmar reagendamento
        </Button>
        <p className="mt-2 text-center text-caption text-text-muted">
          O reagendamento volta para confirmação da barbearia.
        </p>
      </div>
    </div>
  );
}

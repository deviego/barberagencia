"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BARBERS, CURRENT_CLIENT, TIME_SLOTS } from "@/features/client/mock-data";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AgendarPage() {
  const router = useRouter();
  const [barber, setBarber] = useState("any");
  const [day, setDay] = useState(0);
  const [time, setTime] = useState<string | null>(null);

  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return { idx: i, wd: WEEKDAYS[d.getDay()], dd: d.getDate() };
    });
  }, []);

  const c = CURRENT_CLIENT;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Agendar horário</h1>

      {/* Barbeiro */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Barbeiro</div>
        <div className="flex flex-wrap gap-2">
          {BARBERS.map((b) => (
            <Chip key={b.id} active={barber === b.id} onClick={() => setBarber(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      </section>

      {/* Dia */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Data</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.idx}
              onClick={() => setDay(d.idx)}
              className={cn(
                "flex min-w-[52px] flex-col items-center rounded-md border px-3 py-2 transition-colors tabular",
                day === d.idx
                  ? "border-2 border-accent bg-accent-wash text-accent"
                  : "border-border text-text-2 hover:border-accent"
              )}
            >
              <span className="text-caption">{d.wd}</span>
              <span className="text-h5 font-bold">{d.dd}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Horários */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Horário</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {TIME_SLOTS.map((s) => (
            <button
              key={s.time}
              disabled={s.busy}
              onClick={() => setTime(s.time)}
              className={cn(
                "rounded-md border py-2 text-body tabular transition-colors",
                s.busy && "cursor-not-allowed text-text-muted line-through",
                !s.busy && time === s.time && "border-2 border-accent bg-accent-wash text-accent",
                !s.busy && time !== s.time && "border-border text-text hover:border-accent"
              )}
            >
              {s.time}
            </button>
          ))}
        </div>
      </section>

      {/* Resumo */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-inset text-accent">
            <Scissors size={16} />
          </span>
          <div>
            <div className="text-body font-semibold text-text">{c.plan.name}</div>
            <div className="text-caption text-text-muted">
              {BARBERS.find((b) => b.id === barber)?.name} · {days[day].wd} {days[day].dd}
              {time ? ` · ${time}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <span className="text-body text-text-2">Consome do plano · 1 corte</span>
          <span className="text-caption text-text-muted">
            ficam {c.cutsRemaining - 1}/{c.cutsTotal}
          </span>
        </div>
      </div>

      <div className="sticky bottom-24 md:bottom-4">
        <Button
          size="lg"
          className="w-full"
          disabled={!time}
          onClick={() => router.push("/confirmacao")}
        >
          Solicitar agendamento
        </Button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-pill border px-4 py-2 text-body transition-colors",
        active ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
      )}
    >
      {children}
    </button>
  );
}

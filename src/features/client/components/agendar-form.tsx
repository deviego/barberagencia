"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { requestAppointment } from "@/features/client/actions";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_MIN = 45;

interface Barber { id: string; name: string }
interface Service { id: string; name: string; price_brl: number }
interface PlanInfo { comboPlanId: string; name: string; saldo: number }
interface WorkingHour { barber_id: string; weekday: number; start_min: number; end_min: number }

export function AgendarForm({
  barbers,
  services,
  workingHours,
  plan,
}: {
  barbers: Barber[];
  services: Service[];
  workingHours: WorkingHour[];
  plan: PlanInfo | null;
}) {
  const router = useRouter();
  const usePlan = !!plan && plan.saldo > 0;
  const planNoBalance = !!plan && plan.saldo <= 0;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(barbers[0]?.id ?? null);
  const [serviceId, setServiceId] = useState<string | null>(usePlan ? null : (services[0]?.id ?? null));
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

  // Horários já ocupados do barbeiro no dia selecionado.
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
    const supabase = createSupabaseBrowserClient();
    let alive = true;
    supabase
      .rpc("booked_starts", { p_barber_id: barberId, p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => {
        if (alive) setBooked(((data as string[]) ?? []).map((s) => new Date(s).getTime()));
      });
    return () => {
      alive = false;
    };
  }, [days, dayIdx, barberId]);

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
      const res = await requestAppointment({
        barberId,
        serviceId: usePlan ? null : serviceId,
        comboPlanId: usePlan ? plan!.comboPlanId : null,
        startAt: d.toISOString(),
        usePlan,
      });
      if (res.ok) router.push("/confirmacao");
      else setError(res.error);
    });
  }

  const selectedService = services.find((s) => s.id === serviceId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Agendar horário</h1>

      {planNoBalance && (
        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-caption text-warning-strong">
          Você usou todos os cortes do plano este mês. Este agendamento será avulso (pago no local).
        </div>
      )}

      {/* Barbeiro */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Barbeiro</div>
        <div className="flex flex-wrap gap-2">
          {barbers.map((b) => (
            <Chip key={b.id} active={barberId === b.id} onClick={() => setBarberId(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      </section>

      {/* Serviço (avulso ou assinante sem saldo; com saldo, consome do plano) */}
      {!usePlan && (
        <section className="flex flex-col gap-2">
          <div className="text-overline uppercase text-text-muted">Serviço</div>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <Chip key={s.id} active={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                {s.name} · {formatBRL(s.price_brl)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* Dia */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Data</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.idx}
              onClick={() => setDayIdx(d.idx)}
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
        <div className="text-overline uppercase text-text-muted">Horário</div>
        {slots.length === 0 ? (
          <p className="text-caption text-text-muted">
            Sem horários para este barbeiro neste dia. Escolha outro dia ou barbeiro.
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

      {/* Resumo */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-inset text-accent">
            <Scissors size={16} />
          </span>
          <div className="text-body font-semibold text-text">
            {usePlan ? plan!.name : selectedService?.name ?? "Selecione um serviço"}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-body">
          {usePlan ? (
            <>
              <span className="text-text-2">Consome do plano · 1 corte</span>
              <span className="text-caption text-text-muted">ficam {Math.max(0, plan!.saldo - 1)}</span>
            </>
          ) : (
            <>
              <span className="text-text-2">Valor</span>
              <span className="font-bold text-accent tabular">
                {selectedService ? formatBRL(selectedService.price_brl) : "—"}
              </span>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <div className="sticky bottom-24 md:bottom-4">
        <Button size="lg" className="w-full" loading={pending} disabled={!time} onClick={submit}>
          Solicitar agendamento
        </Button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

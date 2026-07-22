"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatBRL, cn } from "@/lib/utils";
import { createAppointmentAdmin } from "@/features/admin/actions";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_MIN = 45;

interface ClientWithPlan {
  id: string;
  name: string;
  plan: { comboPlanId: string; name: string; saldo: number } | null;
}
interface Barber { id: string; name: string }
interface Service { id: string; name: string; price_brl: number }
interface WorkingHour { barber_id: string; weekday: number; start_min: number; end_min: number }

export function NewAppointmentDrawer({
  clients,
  barbers,
  services,
  workingHours,
}: {
  clients: ClientWithPlan[];
  barbers: Barber[];
  services: Service[];
  workingHours: WorkingHour[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("");
  const [barberId, setBarberId] = useState<string | null>(barbers[0]?.id ?? null);
  const [mode, setMode] = useState<"plan" | "service">("service");
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<number[]>([]);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const canUsePlan = !!client?.plan && client.plan.saldo > 0;

  // Ao trocar de cliente, escolhe automaticamente plano (se houver saldo) ou serviço.
  useEffect(() => {
    setMode(client?.plan && client.plan.saldo > 0 ? "plan" : "service");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return { idx: i, wd: WEEKDAYS[d.getDay()], dd: d.getDate(), date: d };
    });
  }, []);

  const slots = useMemo(() => {
    const day = days[dayIdx]?.date;
    if (!day || !barberId) return [];
    const wd = day.getDay();
    const out: string[] = [];
    for (const w of workingHours.filter((x) => x.barber_id === barberId && x.weekday === wd)) {
      for (let t = w.start_min; t + SLOT_MIN <= w.end_min; t += SLOT_MIN) {
        out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      }
    }
    return out.sort();
  }, [days, dayIdx, barberId, workingHours]);

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
    if (!clientId) return setError("Selecione um cliente.");
    if (!time) return setError("Selecione um horário.");
    const usePlan = mode === "plan" && canUsePlan;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    startTransition(async () => {
      const res = await createAppointmentAdmin({
        clientId,
        barberId,
        serviceId: usePlan ? null : serviceId,
        comboPlanId: usePlan ? client!.plan!.comboPlanId : null,
        startAt: d.toISOString(),
        usePlan,
      });
      if (res.ok) {
        setOpen(false);
        setClientId("");
        setTime(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={15} />
        Novo agendamento
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Novo agendamento"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={submit}>
              Confirmar agendamento
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Cliente */}
          <div className="flex flex-col gap-1.5">
            <Label>Cliente</Label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded-md border border-border bg-inset px-3 py-2 text-body text-text focus:border-accent focus:outline-none"
            >
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.plan ? ` · plano ${c.plan.saldo} cortes` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Vínculo: plano ou serviço */}
          {client && (
            <div className="flex flex-col gap-2">
              <Label className="mb-0">Vínculo</Label>
              <div className="flex gap-2">
                {canUsePlan && (
                  <Chip active={mode === "plan"} onClick={() => setMode("plan")}>
                    Plano · {client.plan!.name} ({client.plan!.saldo})
                  </Chip>
                )}
                <Chip active={mode === "service"} onClick={() => setMode("service")}>
                  Serviço avulso
                </Chip>
              </div>
              {client.plan && !canUsePlan && (
                <p className="text-caption text-text-muted">Plano sem saldo — será um serviço avulso.</p>
              )}
            </div>
          )}

          {/* Serviço (quando avulso) */}
          {mode === "service" && (
            <div className="flex flex-col gap-2">
              <Label className="mb-0">Serviço</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <Chip key={s.id} active={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                    {s.name} · {formatBRL(s.price_brl)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Barbeiro */}
          <div className="flex flex-col gap-2">
            <Label className="mb-0">Barbeiro</Label>
            <div className="flex flex-wrap gap-2">
              {barbers.map((b) => (
                <Chip key={b.id} active={barberId === b.id} onClick={() => setBarberId(b.id)}>
                  {b.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Dia */}
          <div className="flex flex-col gap-2">
            <Label className="mb-0">Data</Label>
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
          </div>

          {/* Horário */}
          <div className="flex flex-col gap-2">
            <Label className="mb-0">Horário</Label>
            {slots.length === 0 ? (
              <p className="text-caption text-text-muted">Sem horários para este barbeiro neste dia.</p>
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
          </div>

          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
      </Drawer>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
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

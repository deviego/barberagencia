"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Package, Plus, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { requestAppointment } from "@/features/client/actions";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_MIN = 45;

interface Barber { id: string; name: string }
interface Service { id: string; name: string; price_brl: number; duration_min?: number }
interface Product { id: string; name: string; price_brl: number }
interface PlanInfo { comboPlanId: string; name: string; saldo: number }
interface WorkingHour { barber_id: string; weekday: number; start_min: number; end_min: number }

export function AgendarForm({
  barbers,
  services,
  products,
  workingHours,
  plan,
}: {
  barbers: Barber[];
  services: Service[];
  products: Product[];
  workingHours: WorkingHour[];
  plan: PlanInfo | null;
}) {
  const router = useRouter();
  const planNoBalance = !!plan && plan.saldo <= 0;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(barbers[0]?.id ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>(services[0] ? [services[0].id] : []);
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<number[]>([]);

  // Plano cobre 1 corte (o 1º serviço) quando há saldo e ao menos um serviço na comanda.
  const usePlan = !!plan && plan.saldo > 0 && serviceIds.length > 0;

  function toggleService(id: string) {
    setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function setQty(id: string, qty: number) {
    setProdQty((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[id];
      else n[id] = qty;
      return n;
    });
  }

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
        if (isToday && t <= nowMin) continue;
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

  // Itens da comanda: serviços primeiro (1º = coberto se usePlan), depois produtos.
  const items = useMemo(() => {
    const svc = serviceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is Service => !!s)
      .map((s) => ({ kind: "service" as const, refId: s.id, name: s.name, priceBRL: s.price_brl, qty: 1, durationMin: s.duration_min ?? 0 }));
    const prod = Object.entries(prodQty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const p = products.find((x) => x.id === id)!;
        return { kind: "product" as const, refId: id, name: p.name, priceBRL: p.price_brl, qty: q };
      });
    return [...svc, ...prod];
  }, [serviceIds, prodQty, services, products]);

  const coveredIdx = usePlan ? 0 : -1; // 1º serviço
  const total = items.reduce((s, it, idx) => (idx === coveredIdx ? s : s + it.priceBRL * it.qty), 0);

  function submit() {
    setError(null);
    if (!time) return setError("Escolha um horário.");
    if (items.length === 0) return setError("Adicione ao menos um serviço ou produto.");
    const [h, m] = time.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    startTransition(async () => {
      const res = await requestAppointment({
        barberId,
        comboPlanId: usePlan ? plan!.comboPlanId : null,
        startAt: d.toISOString(),
        usePlan,
        items,
      });
      if (res.ok) router.push("/confirmacao");
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Montar pedido</h1>

      {planNoBalance && (
        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-caption text-warning-strong">
          Você usou todos os cortes do plano este mês. Os itens abaixo serão avulsos (pagos no local).
        </div>
      )}
      {usePlan && (
        <div className="rounded-lg border border-accent bg-accent-wash px-4 py-3 text-caption text-accent">
          Seu plano cobre 1 corte — o primeiro serviço da comanda vai incluído. Extras são pagos no local.
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

      {/* Serviços */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Serviços</div>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <Chip key={s.id} active={serviceIds.includes(s.id)} onClick={() => toggleService(s.id)}>
              {s.name} · {formatBRL(s.price_brl)}
            </Chip>
          ))}
        </div>
      </section>

      {/* Produtos (opcional) */}
      {products.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-overline uppercase text-text-muted">Adicionar produtos (opcional)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => {
              const qty = prodQty[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-surface p-3 transition-colors",
                    qty > 0 ? "border-2 border-accent" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-2 text-body font-semibold text-text">
                    <Package size={16} className="text-accent" /> {p.name}
                  </div>
                  <div className="text-caption font-bold text-accent tabular">{formatBRL(p.price_brl)}</div>
                  {qty === 0 ? (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setQty(p.id, 1)}>
                      <Plus size={14} /> Adicionar
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between rounded-md border-2 border-accent px-1.5 py-1">
                      <button onClick={() => setQty(p.id, qty - 1)} aria-label="Diminuir" className="flex h-6 w-6 items-center justify-center rounded-md text-accent hover:bg-accent-wash">
                        <Minus size={15} />
                      </button>
                      <span className="text-body font-bold tabular text-text">{qty}</span>
                      <button onClick={() => setQty(p.id, qty + 1)} aria-label="Aumentar" className="flex h-6 w-6 items-center justify-center rounded-md text-accent hover:bg-accent-wash">
                        <Plus size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Resumo da comanda */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-overline uppercase text-text-muted">
          <Scissors size={14} className="text-accent" /> Resumo do pedido
        </div>
        {items.length === 0 ? (
          <p className="text-caption text-text-muted">Selecione um serviço para começar.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it, idx) => (
              <div key={`${it.kind}-${it.refId}`} className="flex items-center justify-between text-body">
                <span className="text-text-2">
                  {it.qty > 1 ? `${it.qty}x ` : ""}
                  {it.name}
                </span>
                {idx === coveredIdx ? (
                  <span className="text-caption font-semibold text-accent">Plano · incluído</span>
                ) : (
                  <span className="tabular text-text">{formatBRL(it.priceBRL * it.qty)}</span>
                )}
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
              <span className="text-body font-semibold text-text">Total no local</span>
              <span className="text-h5 font-bold text-accent tabular">{formatBRL(total)}</span>
            </div>
            <p className="text-caption text-text-muted">Pagamento feito no local após o atendimento.</p>
          </div>
        )}
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <div className="sticky bottom-24 md:bottom-4">
        <Button size="lg" className="w-full" loading={pending} disabled={!time || items.length === 0} onClick={submit}>
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

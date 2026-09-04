"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Baby, Check, Clock, Minus, Package, Plus, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildDaySlots, blocksToWindows, type SlotWindow } from "@/lib/schedule/slots";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment";
import { requestAppointment } from "@/features/client/actions";
import { ChildModal, type Child } from "@/features/client/components/child-modal";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Barber { id: string; name: string }
interface Service { id: string; name: string; price_brl: number; duration_min?: number; is_child_service?: boolean }
interface Product { id: string; name: string; price_brl: number }
interface PlanInfo {
  comboPlanId: string;
  name: string;
  saldo: number;
  bookingMode?: string;
  fixed?: { weekday: number | null; startMin: number | null; barberName: string | null } | null;
}
const WEEKDAYS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function minToHHMM(m: number | null | undefined) {
  if (m == null) return "";
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
interface WorkingHour { barber_id: string; weekday: number; start_min: number; end_min: number }

export function AgendarForm({
  barbers,
  services,
  products,
  workingHours,
  plan,
  preselectId = null,
  children: initialChildren = [],
  stepMin = 30,
}: {
  barbers: Barber[];
  services: Service[];
  products: Product[];
  workingHours: WorkingHour[];
  plan: PlanInfo | null;
  preselectId?: string | null;
  children?: Child[];
  stepMin?: number;
}) {
  const router = useRouter();
  // Plano FIXO: o corte do plano é reservado automaticamente no horário fixo — não é
  // marcável aqui. O cliente só marca serviços avulsos.
  const isFixedPlan = plan?.bookingMode === "FIXED";
  const hasPlan = !!plan && plan.saldo > 0 && !isFixedPlan;
  const planNoBalance = !!plan && plan.saldo <= 0 && !isFixedPlan;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(barbers[0]?.id ?? null);
  // Com plano: 1 corte coberto (planServiceId) + serviços avulsos. Sem plano: tudo avulso.
  const [planServiceId, setPlanServiceId] = useState<string | null>(
    hasPlan ? preselectId ?? services[0]?.id ?? null : null
  );
  const [avulsoIds, setAvulsoIds] = useState<string[]>(
    hasPlan ? [] : preselectId ? [preselectId] : services[0] ? [services[0].id] : []
  );
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<number[]>([]);
  const [blocked, setBlocked] = useState<SlotWindow[]>([]);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [childList, setChildList] = useState<Child[]>(initialChildren);
  const [childId, setChildId] = useState<string | null>(null);
  const [childModal, setChildModal] = useState(false);
  const [observations, setObservations] = useState("");

  // Plano cobre 1 corte (o corte do plano) quando há saldo e um corte selecionado.
  const usePlan = hasPlan && !!planServiceId;
  // Todos os serviços da comanda (coberto + avulsos), para regras como "corte infantil".
  const selectedServiceIds = usePlan ? [planServiceId as string, ...avulsoIds] : avulsoIds;
  const needsChild = selectedServiceIds.some((id) => services.find((s) => s.id === id)?.is_child_service);

  function setPlanService(id: string) {
    setPlanServiceId(id);
    setAvulsoIds((cur) => cur.filter((x) => x !== id));
  }
  function toggleAvulso(id: string) {
    setAvulsoIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
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
    const windows = workingHours
      .filter((x) => x.barber_id === barberId && x.weekday === wd)
      .map((w) => ({ startMin: w.start_min, endMin: w.end_min }));
    return buildDaySlots({ windows, stepMin, isToday, nowMin: now.getHours() * 60 + now.getMinutes(), blocked });
  }, [days, dayIdx, barberId, workingHours, stepMin, blocked]);

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
    supabase
      .rpc("blocked_ranges", { p_barber_id: barberId, p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => {
        if (alive) setBlocked(blocksToWindows((data as { starts_at: string; ends_at: string }[]) ?? [], day));
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

  // Itens da comanda: corte do plano primeiro (coberto), depois avulsos, depois produtos.
  const items = useMemo(() => {
    const order = usePlan && planServiceId ? [planServiceId, ...avulsoIds] : avulsoIds;
    const svc = order
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
  }, [usePlan, planServiceId, avulsoIds, prodQty, services, products]);

  const coveredIdx = usePlan ? 0 : -1; // corte do plano é o 1º item
  const total = items.reduce((s, it, idx) => (idx === coveredIdx ? s : s + it.priceBRL * it.qty), 0);
  // Tempo médio estimado do atendimento = soma da duração dos serviços escolhidos.
  const estMin = selectedServiceIds.reduce((s, id) => s + (services.find((x) => x.id === id)?.duration_min ?? 0), 0);

  function submit() {
    setError(null);
    if (!time) return setError("Escolha um horário.");
    if (items.length === 0) return setError("Adicione ao menos um serviço ou produto.");
    if (needsChild && !childId) return setError("Escolha ou registre a criança para o corte infantil.");
    if (!payment) return setError("Escolha a forma de pagamento.");
    const [h, m] = time.split(":").map(Number);
    const d = new Date(days[dayIdx].date);
    d.setHours(h, m, 0, 0);
    startTransition(async () => {
      const res = await requestAppointment({
        barberId,
        comboPlanId: usePlan ? plan!.comboPlanId : null,
        startAt: d.toISOString(),
        usePlan,
        paymentMethod: payment,
        childId: needsChild ? childId : null,
        observations: observations.trim() || null,
        items,
      });
      if (res.ok) router.push(`/client/confirmacao?id=${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Montar pedido</h1>

      {isFixedPlan && plan?.fixed && (
        <div className="rounded-lg border border-accent bg-accent-wash px-4 py-3 text-caption text-accent">
          Seu corte do plano é toda <strong>{WEEKDAYS_PT[plan.fixed.weekday ?? 0]}</strong> às{" "}
          <strong>{minToHHMM(plan.fixed.startMin)}</strong>
          {plan.fixed.barberName ? (
            <>
              {" "}
              com <strong>{plan.fixed.barberName}</strong>
            </>
          ) : null}
          {" "}— já reservado. Veja em <strong>Meus agendamentos</strong>. Aqui você marca apenas serviços avulsos.
        </div>
      )}
      {planNoBalance && (
        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-caption text-warning-strong">
          Você usou todos os cortes do plano este mês. Os itens abaixo serão avulsos (pagos no local).
        </div>
      )}
      {usePlan && (
        <div className="rounded-lg border border-accent bg-accent-wash px-4 py-3 text-caption text-accent">
          Seu plano cobre 1 corte (incluído). Você pode adicionar serviços avulsos — pagos no local.
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
      {hasPlan ? (
        <>
          <section className="flex flex-col gap-2">
            <div className="text-overline uppercase text-text-muted">Corte do plano · incluído</div>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <Chip key={s.id} active={planServiceId === s.id} onClick={() => setPlanService(s.id)}>
                  {s.name}
                  {s.duration_min ? ` · ~${s.duration_min}min` : ""}
                </Chip>
              ))}
            </div>
            <p className="text-caption text-text-muted">Este corte usa 1 do seu saldo — sem custo no local.</p>
          </section>

          <section className="flex flex-col gap-2">
            <div className="text-overline uppercase text-text-muted">Adicionar avulso (opcional)</div>
            <div className="flex flex-wrap gap-2">
              {services
                .filter((s) => s.id !== planServiceId)
                .map((s) => (
                  <Chip key={s.id} active={avulsoIds.includes(s.id)} onClick={() => toggleAvulso(s.id)}>
                    {s.name}
                    {s.duration_min ? ` · ~${s.duration_min}min` : ""} · {formatBRL(s.price_brl)}
                  </Chip>
                ))}
            </div>
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-2">
          <div className="text-overline uppercase text-text-muted">Serviços</div>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <Chip key={s.id} active={avulsoIds.includes(s.id)} onClick={() => toggleAvulso(s.id)}>
                {s.name}
                {s.duration_min ? ` · ~${s.duration_min}min` : ""} · {formatBRL(s.price_brl)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* Criança (quando corte infantil) — destacado */}
      {needsChild && (
        <section className="flex flex-col gap-3 rounded-lg border-2 border-accent bg-accent-wash p-4">
          <div className="flex items-center gap-2 text-body font-bold text-accent">
            <Baby size={18} /> Para qual criança é o corte?
          </div>
          {!childId && (
            <p className="text-caption font-semibold text-accent">
              Selecione a criança abaixo (ou registre uma nova) para continuar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {childList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChildId(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 pr-3 text-left transition-colors",
                  childId === c.id ? "border-2 border-accent bg-accent-wash" : "border-border hover:border-accent"
                )}
              >
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_url} alt={c.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-accent">
                    <Baby size={16} />
                  </span>
                )}
                <span>
                  <span className="block text-body font-semibold text-text">{c.name}</span>
                  {c.age != null && <span className="block text-caption text-text-muted">{c.age} anos</span>}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChildModal(true)}
              className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={14} /> Registrar criança
            </button>
          </div>
        </section>
      )}

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

      {/* Forma de pagamento */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Forma de pagamento (no local)</div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((mtd) => (
            <Chip key={mtd.value} active={payment === mtd.value} onClick={() => setPayment(mtd.value)}>
              {mtd.label}
            </Chip>
          ))}
        </div>
      </section>

      {/* Observações para o barbeiro */}
      <section className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Observações (opcional)</div>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Algo específico para o barbeiro? Ex.: máquina 2 nas laterais, alergia a algum produto…"
          className="w-full rounded-md border border-border bg-surface p-3 text-body text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
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
            {estMin > 0 && (
              <p className="flex items-center gap-1 text-caption text-text-muted">
                <Clock size={12} /> Tempo médio estimado ~{estMin} min
              </p>
            )}
            <p className="text-caption text-text-muted">Pagamento feito no local após o atendimento.</p>
          </div>
        )}
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      <div className="sticky bottom-24 md:bottom-4">
        <Button size="lg" className="w-full" loading={pending} disabled={!time || items.length === 0 || !payment} onClick={submit}>
          Solicitar agendamento
        </Button>
      </div>

      <ChildModal
        open={childModal}
        onClose={() => setChildModal(false)}
        onSaved={(c) => {
          setChildList((cur) => [...cur, c]);
          setChildId(c.id);
        }}
      />
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

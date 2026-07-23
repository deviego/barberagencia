"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { adminCancelAppointment, markDone, markNoShow } from "@/features/admin/actions";
import { cn, formatBRL } from "@/lib/utils";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface ComandaItem {
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
}
interface Appt {
  id: string;
  start_at: string;
  status: string;
  no_show: boolean;
  barber_id: string | null;
  clients: unknown;
  services: unknown;
  combo_plans: unknown;
  appointment_items?: ComandaItem[] | null;
}
interface Barber { id: string; name: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: "Aguardando", cls: "border-warning bg-warning-bg text-warning-strong" },
  CONFIRMED: { label: "Confirmado", cls: "border-accent bg-accent-wash text-accent" },
  ALT_OFFERED: { label: "Outro horário", cls: "border-info bg-info-bg text-info" },
  DONE: { label: "Atendido", cls: "border-success bg-success-bg text-success-strong" },
  CANCELLED: { label: "Cancelado", cls: "border-border bg-inset text-text-muted" },
  EXPIRED: { label: "Expirado", cls: "border-border bg-inset text-text-muted" },
};

function nameOf(a: Appt) {
  return one(a.clients as { name: string }[] | { name: string })?.name ?? "Cliente";
}
function serviceOf(a: Appt) {
  return (
    one(a.services as { name: string }[] | { name: string })?.name ??
    one(a.combo_plans as { name: string }[] | { name: string })?.name ??
    "Serviço"
  );
}

export function AgendaBoard({
  barbers,
  appointments,
  view = "day",
  weekStart,
}: {
  barbers: Barber[];
  appointments: Appt[];
  view?: "day" | "week";
  weekStart?: string; // yyyy-MM-dd (1º dia da semana)
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Appt | null>(null);
  const [pending, startTransition] = useTransition();

  function act(fn: (id: string) => Promise<unknown>) {
    if (!selected) return;
    const id = selected.id;
    startTransition(async () => {
      await fn(id);
      setSelected(null);
      router.refresh();
    });
  }

  function renderChip(a: Appt, withDay = false) {
    const st = STATUS[a.status] ?? STATUS.REQUESTED;
    return (
      <button
        key={a.id}
        onClick={() => setSelected(a)}
        className={cn("w-full rounded-md border px-3 py-2 text-left transition-transform hover:scale-[1.01]", st.cls)}
      >
        <div className="flex items-center justify-between">
          <span className="text-caption font-bold tabular">
            {format(new Date(a.start_at), withDay ? "dd/MM HH:mm" : "HH:mm")}
          </span>
          <span className="text-[10px] uppercase opacity-80">{st.label}</span>
        </div>
        <div className="text-caption font-semibold">{nameOf(a)}</div>
        <div className="text-[11px] opacity-80">{serviceOf(a)}</div>
      </button>
    );
  }

  // ----- Visão SEMANA: 7 colunas por dia -----
  if (view === "week" && weekStart) {
    const base = new Date(weekStart + "T00:00:00");
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
    return (
      <>
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const list = appointments.filter((a) => format(new Date(a.start_at), "yyyy-MM-dd") === key);
            return (
              <div key={key} className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-2 text-center">
                  <div className="text-caption font-semibold capitalize text-text">
                    {format(d, "EEE", { locale: ptBR })}
                  </div>
                  <div className="text-h5 font-bold tabular text-text">{format(d, "dd")}</div>
                </div>
                <div className="flex flex-col gap-2">
                  {list.length === 0 && (
                    <p className="py-2 text-center text-[11px] text-text-muted">—</p>
                  )}
                  {list.map((a) => renderChip(a, true))}
                </div>
              </div>
            );
          })}
        </div>
        {detailDrawer()}
      </>
    );
  }

  // ----- Visão DIA: colunas por barbeiro -----
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {barbers.map((b) => {
        const list = appointments.filter((a) => a.barber_id === b.id);
        return (
          <div key={b.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-wash text-caption font-bold text-accent">
                {b.name.charAt(0)}
              </span>
              <div>
                <div className="text-body font-semibold text-text">{b.name}</div>
                <div className="text-caption text-text-muted">{list.length} agendamento(s)</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {list.length === 0 && (
                <p className="rounded-md border border-dashed border-border-subtle py-4 text-center text-caption text-text-muted">
                  Sem agendamentos.
                </p>
              )}
              {list.map((a) => renderChip(a))}
            </div>
          </div>
        );
      })}

      {detailDrawer()}
    </div>
  );

  function detailDrawer() {
    return (
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Detalhe do agendamento"
        footer={
          selected && (selected.status === "REQUESTED" || selected.status === "CONFIRMED") ? (
            <div className="flex flex-col gap-2">
              <Button className="w-full" loading={pending} onClick={() => act(markDone)}>
                Confirmar presença
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => act(markNoShow)}>
                  Não compareceu
                </Button>
                <Button variant="ghost" className="flex-1" disabled={pending} onClick={() => act(adminCancelAppointment)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-body font-bold text-text-inverse">
                {nameOf(selected).charAt(0)}
              </span>
              <div>
                <div className="text-body font-semibold text-text">{nameOf(selected)}</div>
                <Badge variant="neutral">{(STATUS[selected.status] ?? STATUS.REQUESTED).label}</Badge>
              </div>
            </div>
            <dl className="flex flex-col gap-2 rounded-md border border-border-subtle p-3 text-body">
              <Row label="Serviço" value={serviceOf(selected)} />
              <Row
                label="Horário"
                value={format(new Date(selected.start_at), "EEE, dd MMM · HH:mm", { locale: ptBR })}
              />
              <Row label="Falta" value={selected.no_show ? "Sim" : "Não"} />
            </dl>
            {(selected.appointment_items?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle p-3 text-body">
                <div className="text-overline uppercase text-text-muted">Pedido</div>
                {selected.appointment_items!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-caption">
                    <span className="text-text-2">
                      {it.qty > 1 ? `${it.qty}x ` : ""}
                      {it.name}
                    </span>
                    {it.covered_by_plan ? (
                      <span className="font-semibold text-accent">Plano</span>
                    ) : (
                      <span className="tabular text-text">{formatBRL(it.price_brl * it.qty)}</span>
                    )}
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-border-subtle pt-1.5 text-caption">
                  <span className="font-semibold text-text">A receber no local</span>
                  <span className="tabular font-bold text-accent">
                    {formatBRL(
                      selected.appointment_items!.reduce(
                        (s, it) => (it.covered_by_plan ? s : s + it.price_brl * it.qty),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    );
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

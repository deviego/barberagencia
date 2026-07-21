"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { adminCancelAppointment, markDone, markNoShow } from "@/features/admin/actions";
import { cn } from "@/lib/utils";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
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

export function AgendaBoard({ barbers, appointments }: { barbers: Barber[]; appointments: Appt[] }) {
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
                <div className="text-caption text-text-muted">{list.length} hoje</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {list.length === 0 && (
                <p className="rounded-md border border-dashed border-border-subtle py-4 text-center text-caption text-text-muted">
                  Sem agendamentos.
                </p>
              )}
              {list.map((a) => {
                const st = STATUS[a.status] ?? STATUS.REQUESTED;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={cn("rounded-md border px-3 py-2 text-left transition-transform hover:scale-[1.01]", st.cls)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-caption font-bold tabular">
                        {format(new Date(a.start_at), "HH:mm")}
                      </span>
                      <span className="text-[10px] uppercase opacity-80">{st.label}</span>
                    </div>
                    <div className="text-caption font-semibold">{nameOf(a)}</div>
                    <div className="text-[11px] opacity-80">{serviceOf(a)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

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
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

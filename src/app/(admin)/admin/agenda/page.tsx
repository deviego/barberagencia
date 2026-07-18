"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { AGENDA_HOURS, AGENDA_SLOTS, BARBERS } from "@/features/admin/mock-data";

const KIND_STYLE: Record<string, string> = {
  confirmed: "border-accent bg-accent-wash text-accent",
  pending: "border-warning bg-warning-bg text-warning-strong",
  plan: "border-success bg-success-bg text-success-strong",
};
const KIND_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  plan: "Pago (plano)",
};

interface Selected {
  client: string;
  kind: "confirmed" | "pending" | "plan";
  hour: string;
  barber: string;
}

export default function AgendaPage() {
  const [view, setView] = useState<"day" | "week">("day");
  const [selected, setSelected] = useState<Selected | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">Agenda</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-border p-0.5">
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 text-caption transition-colors",
                  view === v ? "bg-accent-wash text-accent" : "text-text-2"
                )}
              >
                {v === "day" ? "Dia" : "Semana"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-caption text-text-2">
            <button className="rounded-md p-1.5 hover:text-accent" aria-label="Anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="tabular">Sexta, 17 jul</span>
            <button className="rounded-md p-1.5 hover:text-accent" aria-label="Próximo">
              <ChevronRight size={16} />
            </button>
          </div>
          <Button size="sm">
            <Plus size={15} />
            Novo agendamento
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface">
              <th className="w-16 border-b border-border px-3 py-3 text-caption text-text-muted">Hora</th>
              {BARBERS.map((b) => (
                <th key={b.id} className="border-b border-l border-border px-4 py-3 text-left">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-wash text-caption font-bold text-accent">
                      {b.name.charAt(0)}
                    </span>
                    <div>
                      <div className="text-body font-semibold text-text">{b.name}</div>
                      <div className="text-caption text-text-muted">{b.count} hoje</div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AGENDA_HOURS.map((hour) => (
              <tr key={hour}>
                <td className="border-b border-border-subtle px-3 py-2 text-caption text-text-muted tabular">
                  {hour}
                </td>
                {BARBERS.map((b) => {
                  const slot = AGENDA_SLOTS[hour]?.[b.id];
                  return (
                    <td key={b.id} className="border-b border-l border-border-subtle p-1.5 align-top">
                      {slot === "blocked" ? (
                        <div
                          className="flex h-14 items-center justify-center rounded-md text-caption text-text-muted"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(45deg, var(--bb-inset) 0 6px, transparent 6px 12px)",
                          }}
                        >
                          Bloqueado
                        </div>
                      ) : slot ? (
                        <button
                          onClick={() =>
                            setSelected({ client: slot.client, kind: slot.kind, hour, barber: b.name })
                          }
                          className={cn(
                            "flex h-14 w-full flex-col justify-center rounded-md border px-2 text-left transition-transform hover:scale-[1.02]",
                            KIND_STYLE[slot.kind]
                          )}
                        >
                          <span className="text-caption font-semibold">{slot.client}</span>
                          <span className="text-[10px] opacity-80">{KIND_LABEL[slot.kind]}</span>
                        </button>
                      ) : (
                        <div className="h-14 rounded-md border border-dashed border-border-subtle" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer de detalhe do slot */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Detalhe do agendamento"
        footer={
          <div className="flex flex-col gap-2">
            <Button className="w-full">Confirmar presença</Button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1">Reagendar</Button>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </div>
          </div>
        }
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-body font-bold text-text-inverse">
                {selected.client.charAt(0)}
              </span>
              <div>
                <div className="text-body font-semibold text-text">{selected.client}</div>
                <div className="text-caption text-text-muted">
                  {selected.kind === "plan" ? "Combo Mensal 02 · 2/4 restantes" : "Cliente avulso"}
                </div>
              </div>
            </div>
            <dl className="flex flex-col gap-2 rounded-md border border-border-subtle p-3 text-body">
              <Row label="Serviço" value={selected.kind === "plan" ? "Combo Mensal 02" : "Barba Especial"} />
              <Row label="Horário" value={selected.hour} />
              <Row label="Barbeiro" value={selected.barber} />
              <Row label="Pagamento" value={KIND_LABEL[selected.kind]} />
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

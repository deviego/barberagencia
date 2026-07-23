import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge, type AppointmentStatus } from "@/components/status-badge";
import { AppointmentActions } from "@/features/client/components/appointment-actions";
import { formatBRL } from "@/lib/utils";

export function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export interface ComandaItem {
  kind: string;
  name: string;
  price_brl: number;
  qty: number;
  covered_by_plan: boolean;
}
export interface Appt {
  id: string;
  start_at: string;
  status: string;
  consumed_from_plan: boolean;
  barbers: unknown;
  services: unknown;
  combo_plans: unknown;
  appointment_items?: ComandaItem[] | null;
}

const ACTIONABLE = ["REQUESTED", "CONFIRMED", "ALT_OFFERED"];

export function apptTitle(a: Appt) {
  const s = one(a.services as { name: string }[] | { name: string });
  const c = one(a.combo_plans as { name: string }[] | { name: string });
  return s?.name ?? c?.name ?? "Agendamento";
}
function barberName(a: Appt) {
  return one(a.barbers as { name: string }[] | { name: string })?.name ?? null;
}

export function AppointmentCard({ a, highlight, actions }: { a: Appt; highlight?: boolean; actions?: boolean }) {
  const d = new Date(a.start_at);
  const items = a.appointment_items ?? [];
  const total = items.reduce((s, it) => (it.covered_by_plan ? s : s + Number(it.price_brl) * it.qty), 0);

  return (
    <div className={`rounded-lg border bg-surface p-4 ${highlight ? "border-2 border-accent" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-accent-wash text-accent">
            <span className="text-h5 font-bold leading-none tabular">{format(d, "dd")}</span>
            <span className="text-[10px] uppercase">{format(d, "MMM", { locale: ptBR })}</span>
          </span>
          <div>
            <div className="text-body font-semibold text-text">{apptTitle(a)}</div>
            <div className="text-caption text-text-muted tabular">
              {format(d, "EEE, dd MMM · HH:mm", { locale: ptBR })}
              {barberName(a) ? ` · com ${barberName(a)}` : ""}
            </div>
          </div>
        </div>
        <StatusBadge status={a.status as AppointmentStatus} />
      </div>

      {items.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-text-muted">
          {items.map((it, i) => (
            <span key={i}>
              {it.qty > 1 ? `${it.qty}x ` : ""}
              {it.name}
              {i < items.length - 1 ? " ·" : ""}
            </span>
          ))}
          {total > 0 && <span className="font-semibold text-accent">{formatBRL(total)} no local</span>}
        </div>
      )}

      {actions && ACTIONABLE.includes(a.status) && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <AppointmentActions appointmentId={a.id} isPlan={a.consumed_from_plan} />
        </div>
      )}
    </div>
  );
}

export function AppointmentSection({
  label,
  items,
  highlight,
  actions,
}: {
  label: string;
  items: Appt[];
  highlight?: boolean;
  actions?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="text-overline uppercase text-text-muted">
        {label} <span className="text-text-muted">({items.length})</span>
      </div>
      {items.map((a) => (
        <AppointmentCard key={a.id} a={a} highlight={highlight} actions={actions} />
      ))}
    </section>
  );
}

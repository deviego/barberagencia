import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type AppointmentStatus } from "@/components/status-badge";
import { AppointmentActions } from "@/features/client/components/appointment-actions";
import { formatBRL } from "@/lib/utils";
import { getMyAppointments, getMyReservations } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Appt {
  id: string;
  start_at: string;
  status: string;
  consumed_from_plan: boolean;
  barbers: unknown;
  services: unknown;
  combo_plans: unknown;
}

function title(a: Appt) {
  const s = one(a.services as { name: string }[] | { name: string });
  const c = one(a.combo_plans as { name: string }[] | { name: string });
  return s?.name ?? c?.name ?? "Agendamento";
}
function barberName(a: Appt) {
  return one(a.barbers as { name: string }[] | { name: string })?.name ?? null;
}

const CANCELLED_STATUSES = ["CANCELLED", "EXPIRED"];
const ACTIONABLE = ["REQUESTED", "CONFIRMED", "ALT_OFFERED"];

function ApptCard({ a, highlight, actions }: { a: Appt; highlight?: boolean; actions?: boolean }) {
  const d = new Date(a.start_at);
  return (
    <div className={`rounded-lg border bg-surface p-4 ${highlight ? "border-2 border-accent" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-accent-wash text-accent">
            <span className="text-h5 font-bold leading-none tabular">{format(d, "dd")}</span>
            <span className="text-[10px] uppercase">{format(d, "MMM", { locale: ptBR })}</span>
          </span>
          <div>
            <div className="text-body font-semibold text-text">{title(a)}</div>
            <div className="text-caption text-text-muted tabular">
              {format(d, "EEE, dd MMM · HH:mm", { locale: ptBR })}
              {barberName(a) ? ` · com ${barberName(a)}` : ""}
            </div>
          </div>
        </div>
        <StatusBadge status={a.status as AppointmentStatus} />
      </div>
      {actions && ACTIONABLE.includes(a.status) && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <AppointmentActions appointmentId={a.id} isPlan={a.consumed_from_plan} />
        </div>
      )}
    </div>
  );
}

function Section({ label, items, highlight, actions }: { label: string; items: Appt[]; highlight?: boolean; actions?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="text-overline uppercase text-text-muted">
        {label} <span className="text-text-muted">({items.length})</span>
      </div>
      {items.map((a) => (
        <ApptCard key={a.id} a={a} highlight={highlight} actions={actions} />
      ))}
    </section>
  );
}

interface Reservation {
  id: string;
  qty: number;
  status: string;
  created_at: string;
  products: unknown;
}
const RESERVATION_STATUS: Record<string, { label: string; variant: "accent" | "success" | "neutral" }> = {
  RESERVED: { label: "Aguardando retirada", variant: "accent" },
  PICKED_UP: { label: "Retirado", variant: "success" },
  CANCELLED: { label: "Cancelado", variant: "neutral" },
};

export default async function AgendamentosPage() {
  const [all, reservations] = (await Promise.all([getMyAppointments(), getMyReservations()])) as unknown as [
    Appt[],
    Reservation[],
  ];

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayOf = (a: Appt) => format(new Date(a.start_at), "yyyy-MM-dd");

  const cancelled = all
    .filter((a) => CANCELLED_STATUSES.includes(a.status))
    .sort((x, y) => (x.start_at < y.start_at ? 1 : -1));
  const active = all.filter((a) => !CANCELLED_STATUSES.includes(a.status));
  const hoje = active.filter((a) => dayOf(a) === todayStr).sort((x, y) => (x.start_at < y.start_at ? -1 : 1));
  const futuros = active.filter((a) => dayOf(a) > todayStr).sort((x, y) => (x.start_at < y.start_at ? -1 : 1));
  const passados = active.filter((a) => dayOf(a) < todayStr).sort((x, y) => (x.start_at < y.start_at ? 1 : -1));

  const empty = all.length === 0 && reservations.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meus agendamentos</h1>

      {empty && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-text-muted">
          Você ainda não tem agendamentos.
        </p>
      )}

      <Section label="Hoje" items={hoje} highlight actions />
      <Section label="Próximos" items={futuros} highlight actions />
      <Section label="Anteriores" items={passados} />
      <Section label="Cancelados" items={cancelled} />

      {reservations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="text-overline uppercase text-text-muted">
            Produtos solicitados <span className="text-text-muted">({reservations.length})</span>
          </div>
          {reservations.map((r) => {
            const p = one(r.products as { name: string; price_brl: number }[] | { name: string; price_brl: number });
            const st = RESERVATION_STATUS[r.status] ?? RESERVATION_STATUS.RESERVED;
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-inset text-accent">
                    <Package size={18} />
                  </span>
                  <div>
                    <div className="text-body font-semibold text-text">
                      {r.qty}x {p?.name ?? "Produto"}
                    </div>
                    <div className="text-caption text-text-muted tabular">
                      {format(new Date(r.created_at), "dd MMM · HH:mm", { locale: ptBR })}
                      {p ? ` · ${formatBRL(p.price_brl * r.qty)}` : ""}
                    </div>
                  </div>
                </div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

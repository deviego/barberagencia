import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge, type AppointmentStatus } from "@/components/status-badge";
import { AppointmentActions } from "@/features/client/components/appointment-actions";
import { getMyAppointments } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Appt {
  id: string;
  start_at: string;
  status: string;
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

export default async function AgendamentosPage() {
  const { upcoming, past } = (await getMyAppointments()) as unknown as {
    upcoming: Appt[];
    past: Appt[];
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meus agendamentos</h1>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Próximos</div>
        {upcoming.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-text-muted">
            Nenhum agendamento próximo.
          </p>
        )}
        {upcoming.map((a) => {
          const d = new Date(a.start_at);
          return (
            <div key={a.id} className="rounded-lg border-2 border-accent bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-accent-wash text-accent">
                    <span className="text-h5 font-bold leading-none tabular">{format(d, "dd")}</span>
                    <span className="text-[10px] uppercase">{format(d, "MMM", { locale: ptBR })}</span>
                  </span>
                  <div>
                    <div className="text-body font-semibold text-text">{title(a)}</div>
                    <div className="text-caption text-text-muted tabular">
                      {format(d, "EEE · HH:mm", { locale: ptBR })}
                      {barberName(a) ? ` · com ${barberName(a)}` : ""}
                    </div>
                  </div>
                </div>
                <StatusBadge status={a.status as AppointmentStatus} />
              </div>
              {a.status === "CONFIRMED" && (
                <div className="mt-3 border-t border-border-subtle pt-3">
                  <AppointmentActions isPlan />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Histórico</div>
        {past.length === 0 && <p className="text-caption text-text-muted">Sem histórico ainda.</p>}
        {past.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
          >
            <div>
              <div className="text-body font-semibold text-text">{title(a)}</div>
              <div className="text-caption text-text-muted tabular">
                {format(new Date(a.start_at), "dd MMM · HH:mm", { locale: ptBR })}
              </div>
            </div>
            <StatusBadge status={a.status as AppointmentStatus} />
          </div>
        ))}
      </section>
    </div>
  );
}

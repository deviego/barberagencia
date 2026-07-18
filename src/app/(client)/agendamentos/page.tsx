import { StatusBadge } from "@/components/status-badge";
import { AppointmentActions } from "@/features/client/components/appointment-actions";
import { MY_APPOINTMENTS } from "@/features/client/mock-data";

export default function AgendamentosPage() {
  const { upcoming, past } = MY_APPOINTMENTS;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meus agendamentos</h1>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Próximos</div>
        {upcoming.map((a) => (
          <div key={a.id} className="rounded-lg border-2 border-accent bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-accent-wash text-accent">
                  <span className="text-h5 font-bold leading-none tabular">
                    {a.dateLabel.match(/\d+/)?.[0] ?? "–"}
                  </span>
                  <span className="text-[10px] uppercase">{a.dateLabel.slice(0, 3)}</span>
                </span>
                <div>
                  <div className="text-body font-semibold text-text">{a.service}</div>
                  <div className="text-caption text-text-muted tabular">
                    {a.dateLabel} · com {a.barber}
                  </div>
                </div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            {a.status === "CONFIRMED" && (
              <div className="mt-3 border-t border-border-subtle pt-3">
                <AppointmentActions isPlan />
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Histórico</div>
        {past.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
          >
            <div>
              <div className="text-body font-semibold text-text">{a.service}</div>
              <div className="text-caption text-text-muted tabular">{a.dateLabel}</div>
            </div>
            <StatusBadge status={a.status} />
          </div>
        ))}
      </section>
    </div>
  );
}

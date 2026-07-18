import { StatusBadge } from "@/components/status-badge";
import { MY_APPOINTMENTS } from "@/features/client/mock-data";

export default function AgendamentosPage() {
  const { upcoming, past } = MY_APPOINTMENTS;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Meus agendamentos</h1>

      <section className="flex flex-col gap-3">
        <div className="text-overline uppercase text-text-muted">Próximos</div>
        {upcoming.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border-2 border-accent bg-surface p-4"
          >
            <div>
              <div className="text-body font-semibold text-text">{a.service}</div>
              <div className="text-caption text-text-muted tabular">
                {a.dateLabel} · com {a.barber}
              </div>
            </div>
            <StatusBadge status={a.status} />
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

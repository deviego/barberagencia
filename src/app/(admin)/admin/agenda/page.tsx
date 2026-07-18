import { AGENDA_HOURS, AGENDA_SLOTS, BARBERS } from "@/features/admin/mock-data";

const KIND_STYLE: Record<string, string> = {
  confirmed: "border-accent bg-accent-wash text-accent",
  pending: "border-warning bg-warning-bg text-warning-strong",
  plan: "border-success bg-success-bg text-success-strong",
};

export default function AgendaPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">Agenda</h1>
        <div className="flex flex-wrap gap-3 text-caption text-text-muted">
          <Legend className="border-accent bg-accent-wash" label="Confirmado" />
          <Legend className="border-warning bg-warning-bg" label="Pendente" />
          <Legend className="border-success bg-success-bg" label="Pago (plano)" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface">
              <th className="w-16 border-b border-border px-3 py-3 text-caption text-text-muted">Hora</th>
              {BARBERS.map((b) => (
                <th key={b.id} className="border-b border-l border-border px-4 py-3 text-left">
                  <div className="text-body font-semibold text-text">{b.name}</div>
                  <div className="text-caption text-text-muted">{b.count} agendamentos</div>
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
                          className={`flex h-14 w-full flex-col justify-center rounded-md border px-2 text-left transition-transform hover:scale-[1.02] ${KIND_STYLE[slot.kind]}`}
                        >
                          <span className="text-caption font-semibold">{slot.client}</span>
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
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}

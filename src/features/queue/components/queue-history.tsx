import { CheckCircle2, Ticket, UserX, Clock } from "lucide-react";
import type { QueueHistory as QueueHistoryData, QueueDay } from "@/features/queue/data";

/** Resumo do dia + histórico das senhas da fila (fim de dia: quantos atendimentos). */
export function QueueHistory({ data }: { data: QueueHistoryData }) {
  const t = data.today;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-h5 font-bold text-text">Histórico da fila</h2>
        <span className="text-caption text-text-muted">senhas por dia</span>
      </div>

      {/* Resumo de hoje */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<Ticket size={15} />} label="Senhas hoje" value={t.total} />
        <Kpi icon={<CheckCircle2 size={15} />} label="Atendidos" value={t.done} tone="success" />
        <Kpi icon={<Clock size={15} />} label="Na fila agora" value={t.waiting} tone="accent" />
        <Kpi icon={<UserX size={15} />} label="Desistências" value={t.left} tone="muted" />
      </div>

      {/* Histórico por dia */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              <th className="px-4 py-2.5 font-semibold">Dia</th>
              <th className="px-4 py-2.5 text-right font-semibold">Senhas</th>
              <th className="px-4 py-2.5 text-right font-semibold">Atendidos</th>
              <th className="px-4 py-2.5 text-right font-semibold">Desistências</th>
              <th className="px-4 py-2.5 text-right font-semibold">Em aberto</th>
            </tr>
          </thead>
          <tbody>
            {data.days.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-caption text-text-muted">
                  Ainda não há senhas registradas no período.
                </td>
              </tr>
            ) : (
              data.days.map((d) => <Row key={d.day} d={d} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ d }: { d: QueueDay }) {
  return (
    <tr className="border-b border-border-subtle">
      <td className="px-4 py-2.5 text-text">{fmtDay(d.day)}</td>
      <td className="px-4 py-2.5 text-right text-text tabular">{d.total}</td>
      <td className="px-4 py-2.5 text-right text-success-strong tabular">{d.done}</td>
      <td className="px-4 py-2.5 text-right text-text-2 tabular">{d.left}</td>
      <td className="px-4 py-2.5 text-right text-text-2 tabular">{d.waiting}</td>
    </tr>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "success" | "accent" | "muted";
}) {
  const color =
    tone === "success" ? "text-success-strong" : tone === "accent" ? "text-accent" : tone === "muted" ? "text-text-2" : "text-text";
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-caption text-text-muted">
        {icon} {label}
      </div>
      <div className={`mt-1 font-display text-h3 font-black tabular ${color}`}>{value}</div>
    </div>
  );
}

/** "2026-08-22" → "22/08" (rótulo; sem recriar Date com fuso). */
function fmtDay(day: string): string {
  const [, m, d] = day.split("-");
  return d && m ? `${d}/${m}` : day;
}

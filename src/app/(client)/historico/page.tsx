import { format } from "date-fns";
import { AppointmentSection, type Appt } from "@/features/client/components/appointment-card";
import { getMyAppointments } from "@/features/client/data";

const CANCELLED_STATUSES = ["CANCELLED", "EXPIRED"];

export default async function HistoricoPage() {
  const all = (await getMyAppointments()) as unknown as Appt[];

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayOf = (a: Appt) => format(new Date(a.start_at), "yyyy-MM-dd");

  const cancelled = all
    .filter((a) => CANCELLED_STATUSES.includes(a.status))
    .sort((x, y) => (x.start_at < y.start_at ? 1 : -1));
  const anteriores = all
    .filter((a) => !CANCELLED_STATUSES.includes(a.status) && dayOf(a) < todayStr)
    .sort((x, y) => (x.start_at < y.start_at ? 1 : -1));

  const empty = anteriores.length === 0 && cancelled.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Histórico</h1>

      {empty && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-text-muted">
          Você ainda não tem histórico de atendimentos.
        </p>
      )}

      <AppointmentSection label="Anteriores" items={anteriores} />
      <AppointmentSection label="Cancelados" items={cancelled} />
    </div>
  );
}

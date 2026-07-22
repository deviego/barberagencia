import Link from "next/link";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgendaBoard } from "@/features/admin/components/agenda-board";
import { NewAppointmentDrawer } from "@/features/admin/components/new-appointment-drawer";
import { getAgenda, getBarbers, getClientsWithPlan, getServices, getWorkingHours } from "@/features/admin/data";
import { cn } from "@/lib/utils";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view: "day" | "week" = params.view === "week" ? "week" : "day";
  const today = format(new Date(), "yyyy-MM-dd");
  const dateStr = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const base = new Date(dateStr + "T00:00:00");

  let from: Date;
  let to: Date;
  let weekStart: string | undefined;
  if (view === "week") {
    const ws = addDays(base, -base.getDay()); // inicia no domingo
    from = ws;
    to = addDays(ws, 7);
    weekStart = format(ws, "yyyy-MM-dd");
  } else {
    from = base;
    to = addDays(base, 1);
  }

  const [barbers, appointments, clients, services, workingHours] = await Promise.all([
    getBarbers(),
    getAgenda(from.toISOString(), to.toISOString()),
    getClientsWithPlan(),
    getServices(),
    getWorkingHours(),
  ]);
  const activeBarbers = barbers.filter((b) => b.active !== false);
  const activeServices = (services as { id: string; name: string; price_brl: number; active: boolean }[]).filter(
    (s) => s.active !== false
  );

  const step = view === "week" ? 7 : 1;
  const prev = format(addDays(base, -step), "yyyy-MM-dd");
  const next = format(addDays(base, step), "yyyy-MM-dd");
  const label =
    view === "week"
      ? `${format(from, "dd MMM", { locale: ptBR })} – ${format(addDays(to, -1), "dd MMM", { locale: ptBR })}`
      : format(base, "EEE, dd MMM", { locale: ptBR });
  const hrefFor = (d: string, v: string) => `/admin/agenda?date=${d}&view=${v}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">Agenda</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-border p-0.5">
            <Link
              href={hrefFor(dateStr, "day")}
              className={cn("rounded-[6px] px-3 py-1.5 text-caption", view === "day" ? "bg-accent-wash text-accent" : "text-text-2")}
            >
              Dia
            </Link>
            <Link
              href={hrefFor(dateStr, "week")}
              className={cn("rounded-[6px] px-3 py-1.5 text-caption", view === "week" ? "bg-accent-wash text-accent" : "text-text-2")}
            >
              Semana
            </Link>
          </div>
          <div className="flex items-center gap-1 text-caption text-text-2">
            <Link href={hrefFor(prev, view)} className="rounded-md p-1.5 hover:text-accent" aria-label="Anterior">
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-[130px] text-center capitalize tabular">{label}</span>
            <Link href={hrefFor(next, view)} className="rounded-md p-1.5 hover:text-accent" aria-label="Próximo">
              <ChevronRight size={16} />
            </Link>
          </div>
          <NewAppointmentDrawer
            clients={clients}
            barbers={activeBarbers}
            services={activeServices}
            workingHours={workingHours}
          />
        </div>
      </div>

      <AgendaBoard barbers={activeBarbers} appointments={appointments} view={view} weekStart={weekStart} />
    </div>
  );
}

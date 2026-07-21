import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaBoard } from "@/features/admin/components/agenda-board";
import { getBarbers, getTodayAppointments } from "@/features/admin/data";

export default async function AgendaPage() {
  const [barbers, appointments] = await Promise.all([getBarbers(), getTodayAppointments()]);
  const activeBarbers = barbers.filter((b) => b.active !== false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">Agenda</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-border p-0.5">
            <span className="rounded-[6px] bg-accent-wash px-3 py-1.5 text-caption text-accent">Dia</span>
            <span className="rounded-[6px] px-3 py-1.5 text-caption text-text-2">Semana</span>
          </div>
          <div className="flex items-center gap-1 text-caption text-text-2">
            <button className="rounded-md p-1.5 hover:text-accent" aria-label="Anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="tabular capitalize">
              {format(new Date(), "EEE, dd MMM", { locale: ptBR })}
            </span>
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

      <AgendaBoard barbers={activeBarbers} appointments={appointments} />
    </div>
  );
}

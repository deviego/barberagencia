import Link from "next/link";
import { CalendarClock, CreditCard, Headphones, ShoppingBag } from "lucide-react";
import { CutMeter } from "@/components/cut-meter";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { CURRENT_CLIENT } from "@/features/client/mock-data";

export default function ClientHome() {
  const c = CURRENT_CLIENT;
  const appt = c.nextAppointment;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Olá, {c.name} 👋</h1>

      {/* Próximo agendamento */}
      <div className="relative overflow-hidden rounded-lg border-2 border-accent bg-surface p-5 shadow-md">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background:
              "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 10px, var(--bb-pole-white) 10px 20px, var(--bb-pole-blue) 20px 30px)",
          }}
        />
        <div className="mb-3 flex items-center justify-between">
          <span className="text-overline uppercase text-text-muted">Próximo agendamento</span>
          <StatusBadge status={appt.status} />
        </div>
        <div className="text-h4 font-semibold text-text">{appt.service}</div>
        <div className="mt-1 text-body text-text-2 tabular">
          {appt.dateLabel} · {appt.timeLabel} · com {appt.barber}
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" size="sm">
            Reagendar
          </Button>
          <Button variant="ghost" size="sm">
            Cancelar
          </Button>
        </div>
      </div>

      {/* Medidor de cortes */}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6">
        <CutMeter remaining={c.cutsRemaining} total={c.cutsTotal} />
        <div className="text-center">
          <div className="text-body font-semibold text-text">{c.plan.name}</div>
          <div className="text-caption text-text-muted">
            {c.cutsRemaining} de {c.cutsTotal} cortes neste mês · renova dia {c.billingDay}
          </div>
        </div>
      </div>

      {/* CTA AGENDAR */}
      <Link href="/agendar">
        <button className="flex h-16 w-full items-center justify-center rounded-lg bg-accent font-display text-h2 uppercase text-text-inverse shadow-md transition-colors hover:bg-accent-hover">
          Agendar
        </button>
      </Link>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Shortcut href="/meu-plano" icon={<CreditCard size={22} />} label="Meu plano" />
        <Shortcut href="/agendamentos" icon={<CalendarClock size={22} />} label="Agendamentos" />
        <Shortcut href="/servicos" icon={<ShoppingBag size={22} />} label="Serviços" />
        <Shortcut href="/suporte" icon={<Headphones size={22} />} label="Suporte" />
      </div>
    </div>
  );
}

function Shortcut({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
    >
      <span className="text-accent">{icon}</span>
      {label}
    </Link>
  );
}

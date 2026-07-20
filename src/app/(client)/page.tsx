import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CreditCard, Headphones, Scissors, ShoppingBag } from "lucide-react";
import { CutMeter } from "@/components/cut-meter";
import { StatusBadge, type AppointmentStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { AppointmentActions } from "@/features/client/components/appointment-actions";
import { getClientHome } from "@/features/client/data";

// Relações "to-one" do supabase podem vir como objeto ou array de 1 — normaliza.
function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function ClientHome() {
  const home = await getClientHome();
  const firstName = home?.client?.name?.split(" ")[0] ?? "";
  const sub = home?.sub as
    | { saldo_cortes: number; billing_day: number; combo_plans: { name: string; cuts: number } | { name: string; cuts: number }[] }
    | null
    | undefined;
  const combo = one(sub?.combo_plans);
  const next = home?.next as
    | { start_at: string; status: string; barbers: unknown; services: unknown; combo_plans: unknown }
    | null
    | undefined;

  const nextService = one(next?.services as { name: string }[] | { name: string }) ?? one(next?.combo_plans as { name: string }[] | { name: string });
  const nextBarber = one(next?.barbers as { name: string }[] | { name: string });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">Olá, {firstName}</h1>
        <p className="mt-1 text-body text-text-muted">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Próximo agendamento */}
      {next ? (
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
            <StatusBadge status={next.status as AppointmentStatus} />
          </div>
          <div className="text-h4 font-semibold text-text">{nextService?.name ?? "Agendamento"}</div>
          <div className="mt-1 text-body text-text-2 tabular">
            {format(new Date(next.start_at), "EEE, dd MMM · HH:mm", { locale: ptBR })}
            {nextBarber ? ` · com ${nextBarber.name}` : ""}
          </div>
          <div className="mt-4">
            <AppointmentActions isPlan={!!combo} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-body text-text-2">Você não tem agendamentos.</p>
        </div>
      )}

      {/* Medidor de cortes (se assinante) */}
      {sub && combo && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6">
          <CutMeter remaining={sub.saldo_cortes} total={combo.cuts} />
          <div className="text-center">
            <div className="text-body font-semibold text-text">{combo.name}</div>
            <div className="text-caption text-text-muted">
              {sub.saldo_cortes} de {combo.cuts} cortes neste mês · renova dia {sub.billing_day}
            </div>
          </div>
          <Link href="/meu-plano">
            <Button variant="outline" size="sm">
              Ver meu plano
            </Button>
          </Link>
        </div>
      )}

      {/* CTA AGENDAR */}
      <Link href="/servicos">
        <button className="flex h-16 w-full items-center justify-center gap-3 rounded-lg bg-accent font-display text-h2 uppercase text-text-inverse shadow-md transition-colors hover:bg-accent-hover">
          <Scissors size={26} />
          Agendar
        </button>
      </Link>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Shortcut href="/meu-plano" icon={<CreditCard size={22} />} label="Meu plano" />
        <Shortcut href="/agendamentos" icon={<CalendarClock size={22} />} label="Agendamentos" />
        <Shortcut href="/produtos" icon={<ShoppingBag size={22} />} label="Produtos" />
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

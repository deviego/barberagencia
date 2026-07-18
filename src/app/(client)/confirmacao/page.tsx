import Link from "next/link";
import { Clock, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { CutMeter } from "@/components/cut-meter";
import { Button } from "@/components/ui/button";
import { CURRENT_CLIENT } from "@/features/client/mock-data";

export default function ConfirmacaoPage() {
  const c = CURRENT_CLIENT;
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-bg">
        <Clock size={30} className="text-warning-strong" />
      </div>
      <div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">Solicitação enviada</h1>
        <p className="mt-2 max-w-md text-body text-text-2">
          Aguardando confirmação da barbearia — normalmente em até <strong>10 minutos</strong>. Você
          será avisado assim que for confirmado.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-5">
        <CutMeter remaining={c.cutsRemaining - 1} total={c.cutsTotal} size={110} />
        <div className="text-caption text-text-muted">Saldo reservado para esta sessão</div>
      </div>

      {/* Mocks de notificação */}
      <div className="grid w-full gap-3 sm:grid-cols-3">
        <NotifCard icon={<Mail size={16} />} channel="E-mail">
          Recebemos sua solicitação para {c.nextAppointment.dateLabel} às {c.nextAppointment.timeLabel}.
        </NotifCard>
        <NotifCard icon={<MessageSquare size={16} />} channel="SMS">
          Olá {c.name}! Sua solicitação foi enviada. Confirmamos em breve.
        </NotifCard>
        <NotifCard icon={<MessageCircle size={16} />} channel="WhatsApp" green>
          {c.name}, recebemos seu pedido ✅ Aguardando confirmação da barbearia.
        </NotifCard>
      </div>

      <Link href="/agendamentos" className="w-full max-w-xs">
        <Button size="lg" className="w-full">
          Ver meus agendamentos
        </Button>
      </Link>
    </div>
  );
}

function NotifCard({
  icon,
  channel,
  green,
  children,
}: {
  icon: React.ReactNode;
  channel: string;
  green?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-surface p-3 text-left"
      style={green ? { borderColor: "#25D366", background: "rgba(37,211,102,0.08)" } : undefined}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-overline uppercase text-text-muted">
        <span style={green ? { color: "#25D366" } : { color: "var(--bb-accent)" }}>{icon}</span>
        {channel}
      </div>
      <p className="text-caption text-text-2">{children}</p>
    </div>
  );
}

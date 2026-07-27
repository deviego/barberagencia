"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Tela de acompanhamento da solicitação — reage em tempo real quando o admin decide. */
export function ConfirmacaoView({ appointmentId }: { appointmentId: string | null }) {
  const [status, setStatus] = useState<string>("REQUESTED");

  useEffect(() => {
    if (!appointmentId) return;
    const supabase = createSupabaseBrowserClient();
    let alive = true;

    // Estado inicial (pode já ter mudado antes de a tela montar).
    supabase
      .from("appointments")
      .select("status")
      .eq("id", appointmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data?.status) setStatus(data.status as string);
      });

    const channel = supabase
      .channel(`appt-${appointmentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments", filter: `id=eq.${appointmentId}` },
        (payload) => {
          const s = (payload.new as { status?: string })?.status;
          if (s) setStatus(s);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [appointmentId]);

  const confirmed = status === "CONFIRMED";
  const refused = status === "CANCELLED" || status === "EXPIRED";
  const alt = status === "ALT_OFFERED";

  const view = confirmed
    ? {
        icon: <CheckCircle2 size={30} className="text-success-strong" />,
        iconBg: "bg-success-bg",
        title: "Agendamento confirmado",
        badge: <Badge variant="success">Confirmado</Badge>,
        message: "Tudo certo! Seu horário foi confirmado pela barbearia. Você recebeu os detalhes no WhatsApp.",
      }
    : refused
      ? {
          icon: <XCircle size={30} className="text-danger-strong" />,
          iconBg: "bg-danger-bg",
          title: "Solicitação não confirmada",
          badge: <Badge variant="danger">Não confirmado</Badge>,
          message:
            "Este horário não pôde ser confirmado (recusado ou expirado). Que tal escolher outro horário?",
        }
      : alt
        ? {
            icon: <CalendarClock size={30} className="text-info-strong" />,
            iconBg: "bg-info-bg",
            title: "Outro horário sugerido",
            badge: <Badge variant="info">Novo horário</Badge>,
            message: "A barbearia sugeriu um horário diferente. Confira em Meus agendamentos.",
          }
        : {
            icon: <Clock size={30} className="text-warning-strong" />,
            iconBg: "bg-warning-bg",
            title: "Solicitação enviada",
            badge: <Badge variant="warning">Aguardando confirmação</Badge>,
            message:
              "Em breve você será atendido. Confira o WhatsApp cadastrado — assim que a barbearia confirmar, avisamos por aqui e esta tela atualiza sozinha.",
          };

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${view.iconBg}`}>{view.icon}</div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-display text-h2 uppercase leading-none text-text">{view.title}</h1>
        {view.badge}
        <p className="mt-1 max-w-md text-body text-text-2">{view.message}</p>
      </div>

      {/* Regras de cancelamento (enquanto aguardando ou confirmado) */}
      {!refused && !alt && (
        <div className="w-full rounded-lg border border-border bg-surface p-4 text-left">
          <div className="mb-2 text-overline uppercase text-text-muted">Regras de cancelamento</div>
          <ul className="flex flex-col gap-1 text-caption text-text-2">
            <li>• Pelo app: cancele com no mínimo 10 minutos de antecedência.</li>
            <li>• Imprevisto? Avise no WhatsApp com até 30 minutos antes do horário.</li>
          </ul>
          <div className="mt-3 rounded-md border border-danger bg-danger-bg p-3 text-caption font-bold uppercase text-danger-strong">
            Em caso de falta sem aviso prévio, o processo de agendamento poderá ser desativado pelo aplicativo.
          </div>
        </div>
      )}

      {refused ? (
        <Link href="/client/agendar" className="w-full max-w-xs">
          <Button size="lg" className="w-full">
            Agendar novamente
          </Button>
        </Link>
      ) : (
        <Link href="/client/agendamentos" className="w-full max-w-xs">
          <Button size="lg" className="w-full" variant={confirmed ? "primary" : "outline"}>
            Ver meus agendamentos
          </Button>
        </Link>
      )}
    </div>
  );
}

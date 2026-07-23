import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ConfirmacaoPage() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-bg">
        <Clock size={30} className="text-warning-strong" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-display text-h2 uppercase leading-none text-text">Solicitação enviada</h1>
        <Badge variant="warning">Aguardando confirmação</Badge>
        <p className="mt-1 max-w-md text-body text-text-2">
          A barbearia vai confirmar seu horário — normalmente em até <strong>10 minutos</strong>.
          Você será avisado assim que for confirmado.
        </p>
      </div>

      {/* Regras de cancelamento */}
      <div className="w-full rounded-lg border border-border bg-surface p-4 text-left">
        <div className="mb-2 text-overline uppercase text-text-muted">Regras de cancelamento</div>
        <ul className="flex flex-col gap-1 text-caption text-text-2">
          <li>• Pelo app: cancele com no mínimo 10 minutos de antecedência.</li>
          <li>• Imprevisto? Avise no WhatsApp com até 30 minutos antes do horário.</li>
          <li>• Faltar sem avisar pode restringir novos agendamentos online.</li>
        </ul>
      </div>

      <Link href="/agendamentos" className="w-full max-w-xs">
        <Button size="lg" className="w-full">
          Ver meus agendamentos
        </Button>
      </Link>
    </div>
  );
}

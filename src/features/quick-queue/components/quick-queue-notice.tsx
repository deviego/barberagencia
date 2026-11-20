import { Store, Clock } from "lucide-react";
import { QUICK_QUEUE_MESSAGES } from "../types";

/**
 * Avisos da fila rápida sem formulário: barbearia não encontrada ou fila indisponível
 * (plano sem fila, fila rápida desligada ou fila sem receber senhas). Não mostra dado nenhum
 * além do texto, e o texto não diz qual foi o motivo.
 */
export function QuickQueueNotice({ kind }: { kind: "NOT_FOUND" | "UNAVAILABLE" }) {
  const Icon = kind === "NOT_FOUND" ? Store : Clock;
  const text = kind === "NOT_FOUND" ? QUICK_QUEUE_MESSAGES.notFound : QUICK_QUEUE_MESSAGES.unavailable;

  return (
    <div role="status" className="my-auto flex flex-col items-center gap-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <p className="max-w-[280px] text-body-lg font-semibold text-text">{text}</p>
    </div>
  );
}

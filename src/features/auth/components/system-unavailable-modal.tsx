"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BARBERAGENCIA_WHATSAPP, waLink } from "@/lib/contact";

const SUPPORT_MESSAGE = "Olá! Não estou conseguindo acessar o painel da minha barbearia. Podem me ajudar?";

/**
 * Pop-up "Sistema indisponível" para a equipe de barbearia suspensa pelo MASTER.
 * Mensagem neutra (sem falar em bloqueio) + contato com o suporte da Barber Agência.
 * Sem `onClose` o pop-up não pode ser fechado (usado no painel).
 */
export function SystemUnavailableModal({ onClose }: { onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-unavailable-title"
        className="w-[420px] max-w-full rounded-lg border border-border bg-elevated p-6 text-center shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="system-unavailable-title" className="text-h4 font-semibold text-text">
          Sistema indisponível no momento
        </h3>
        <p className="mt-2 text-body text-text-2">
          Estamos fazendo melhorias na plataforma. Para mais informações, entre em contato com o nosso suporte.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <a href={waLink(BARBERAGENCIA_WHATSAPP, SUPPORT_MESSAGE)} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="w-full">
              <MessageCircle size={16} /> Entrar em contato
            </Button>
          </a>
          {onClose && (
            <button onClick={onClose} className="py-1.5 text-caption text-text-muted hover:text-text">
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

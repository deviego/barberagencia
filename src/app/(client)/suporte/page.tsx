"use client";

import { useState } from "react";
import { MessageCircle, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK_REPLIES = [
  "Quero remarcar um horário",
  "Dúvida sobre meu plano",
  "Falar sobre pagamento",
  "Outro assunto",
];

export default function SuportePage() {
  const [rating, setRating] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Suporte e atendimento</h1>

      {/* WhatsApp */}
      <a
        href="https://wa.me/5521990883359"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg p-4 text-white shadow-md transition-transform hover:scale-[1.01]"
        style={{ background: "#25D366" }}
      >
        <MessageCircle size={24} />
        <div>
          <div className="text-body font-bold">Falar no WhatsApp</div>
          <div className="text-caption opacity-90">Atendimento direto com a barbearia</div>
        </div>
      </a>

      {/* Assistente virtual */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Assistente virtual</div>
        <div className="rounded-md bg-inset p-3 text-body text-text-2">
          Olá! 👋 Como posso ajudar você hoje?
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Escreva sua mensagem…"
            className="h-10 flex-1 rounded-md border border-border bg-inset px-3 text-body text-text placeholder:text-text-muted focus-visible:border-focus focus-visible:outline-none"
          />
          <Button size="icon" aria-label="Enviar">
            <Send size={16} />
          </Button>
        </div>
      </section>

      {/* Avaliação */}
      <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-5 text-center">
        <div className="text-body font-semibold text-text">Como foi seu atendimento?</div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}>
              <Star
                size={30}
                className={cn(
                  "transition-colors",
                  n <= rating ? "fill-accent text-accent" : "text-n700"
                )}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <Button size="sm" variant="outline">
            Enviar avaliação
          </Button>
        )}
      </section>
    </div>
  );
}

import { Mail, MessageCircle } from "lucide-react";
import { SupportForm } from "@/features/admin/components/support-form";
import { BARBERAGENCIA_EMAIL, BARBERAGENCIA_WHATSAPP, BARBERAGENCIA_WHATSAPP_DISPLAY, waLink } from "@/lib/contact";

export default function SuportePage() {
  const wa = waLink(BARBERAGENCIA_WHATSAPP, "Olá! Preciso de suporte na Barber Agência.");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Suporte</h1>
        <p className="text-body text-text-2">
          Precisa de ajuda? Fale com a gente no WhatsApp ou envie sua mensagem — o time responde por e-mail.
        </p>
      </div>

      {/* Contato direto com a Barber Agência */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center gap-3 rounded-lg p-4 text-white shadow-md transition-transform hover:scale-[1.01]"
          style={{ background: "#25D366" }}
        >
          <MessageCircle size={24} />
          <div>
            <div className="text-body font-bold">Falar no WhatsApp</div>
            <div className="text-caption opacity-90">{BARBERAGENCIA_WHATSAPP_DISPLAY}</div>
          </div>
        </a>
        <a
          href={`mailto:${BARBERAGENCIA_EMAIL}`}
          className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
        >
          <Mail size={24} className="text-accent" />
          <div>
            <div className="text-body font-bold text-text">E-mail</div>
            <div className="text-caption text-text-muted">{BARBERAGENCIA_EMAIL}</div>
          </div>
        </a>
      </div>

      <SupportForm />
    </div>
  );
}

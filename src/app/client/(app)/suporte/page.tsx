import { MessageCircle } from "lucide-react";
import { SuporteInteractive } from "./suporte-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { waLink } from "@/lib/contact";

export default async function SuportePage() {
  // Contato = telefone da PRÓPRIA barbearia do cliente (nunca um número fixo/de outra barbearia).
  const tenant = await getCurrentTenant();
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("phone")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const phone = (settings?.phone as string | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Suporte e atendimento</h1>

      {phone ? (
        <a
          href={waLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg p-4 text-white shadow-md transition-transform hover:scale-[1.01]"
          style={{ background: "#25D366" }}
        >
          <MessageCircle size={24} />
          <div>
            <div className="text-body font-bold">Falar no WhatsApp</div>
            <div className="text-caption opacity-90">Atendimento direto com {tenant.name}</div>
          </div>
        </a>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 text-caption text-text-muted">
          O WhatsApp de atendimento ainda não foi configurado pela barbearia.
        </div>
      )}

      <SuporteInteractive />
    </div>
  );
}

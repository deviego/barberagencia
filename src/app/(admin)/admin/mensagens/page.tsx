import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageTemplatesList } from "@/features/admin/components/message-templates-list";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { hasEntitlement } from "@/lib/entitlements";

export default async function MensagensPage() {
  const tenant = await getCurrentTenant();
  if (!hasEntitlement(tenant.saasPlan, "whatsapp.manual")) {
    return (
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash">
          <Lock size={24} className="text-accent" />
        </div>
        <h1 className="text-h4 font-semibold text-text">Mensagens indisponíveis</h1>
        <p className="text-body text-text-2">Os modelos de mensagem estão disponíveis a partir do seu plano.</p>
        <Button>Ver planos</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Mensagens</h1>
        <p className="text-body text-text-2">
          Modelos prontos para WhatsApp. Copie ou abra direto no WhatsApp com o texto preenchido.
        </p>
      </div>
      <MessageTemplatesList />
    </div>
  );
}

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { hasEntitlement } from "@/lib/entitlements";
import { RedeView } from "@/features/platform/components/rede-view";

export default async function RedePage() {
  const tenant = await getCurrentTenant();

  if (!hasEntitlement(tenant.saasPlan, "network.multiUnit")) {
    return (
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash">
          <Lock size={24} className="text-accent" />
        </div>
        <h1 className="text-h4 font-semibold text-text">Recurso de rede indisponível</h1>
        <p className="text-body text-text-2">
          A gestão consolidada de múltiplas unidades está disponível no plano{" "}
          <strong>Advanced</strong>.
        </p>
        <Button>Ver planos</Button>
      </div>
    );
  }

  return <RedeView />;
}

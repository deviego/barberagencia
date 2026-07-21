import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingForm } from "@/features/admin/components/marketing-form";
import { getCampaigns } from "@/features/admin/data";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { hasEntitlement } from "@/lib/entitlements";

const STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  DRAFT: { label: "Rascunho", variant: "neutral" },
  SCHEDULED: { label: "Agendada", variant: "info" },
  ACTIVE: { label: "Ativa", variant: "success" },
  ENDED: { label: "Encerrada", variant: "neutral" },
};

export default async function MarketingPage() {
  const tenant = await getCurrentTenant();
  if (!hasEntitlement(tenant.saasPlan, "marketing.basic")) {
    return (
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash">
          <Lock size={24} className="text-accent" />
        </div>
        <h1 className="text-h4 font-semibold text-text">Marketing indisponível</h1>
        <p className="text-body text-text-2">Campanhas estão disponíveis a partir do plano Essencial.</p>
        <Button>Ver planos</Button>
      </div>
    );
  }

  const campaigns = (await getCampaigns()) as { id: string; name: string; segment: string; status: string; reach: number }[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Marketing</h1>

      <MarketingForm canSegmented={hasEntitlement(tenant.saasPlan, "marketing.segmented")} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              <th className="px-4 py-3 font-semibold">Campanha</th>
              <th className="px-4 py-3 font-semibold">Segmento</th>
              <th className="px-4 py-3 font-semibold">Alcance</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-muted">
                  Nenhuma campanha criada.
                </td>
              </tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-border-subtle">
                <td className="px-4 py-3 text-text">{c.name}</td>
                <td className="px-4 py-3 text-text-2">{c.segment}</td>
                <td className="px-4 py-3 text-text tabular">{c.reach}</td>
                <td className="px-4 py-3">
                  <Badge variant={(STATUS[c.status] ?? STATUS.ACTIVE).variant}>
                    {(STATUS[c.status] ?? STATUS.ACTIVE).label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

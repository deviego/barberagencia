import { Lock, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { hasEntitlement } from "@/lib/entitlements";
import { CAMPAIGNS } from "@/features/admin/mock-data";

const SEGMENTS = ["Inativos 60+ dias", "Assinantes", "Avulsos", "Aniversariantes"];
const STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  ACTIVE: { label: "Ativa", variant: "success" },
  SCHEDULED: { label: "Agendada", variant: "info" },
  ENDED: { label: "Encerrada", variant: "neutral" },
};

export default async function MarketingPage() {
  const tenant = await getCurrentTenant();
  const canBasic = hasEntitlement(tenant.saasPlan, "marketing.basic");
  const canSegmented = hasEntitlement(tenant.saasPlan, "marketing.segmented");

  if (!canBasic) {
    return (
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash">
          <Lock size={24} className="text-accent" />
        </div>
        <h1 className="text-h4 font-semibold text-text">Marketing indisponível</h1>
        <p className="text-body text-text-2">
          Campanhas de e-mail marketing estão disponíveis a partir do plano{" "}
          <strong>Profissional</strong>. Faça upgrade para ativar.
        </p>
        <Button>Ver planos</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-bold text-text">Marketing</h1>
        <Button>
          <Megaphone size={16} />
          Nova campanha
        </Button>
      </div>

      {/* Criar campanha */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Criar campanha</div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-text-2">Nome da campanha</span>
          <input
            placeholder="Ex.: Sentimos sua falta!"
            className="h-10 rounded-md border border-border bg-inset px-3 text-body text-text placeholder:text-text-muted focus-visible:border-focus focus-visible:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-text-2">
            Segmento {canSegmented ? "" : "(básico)"}
          </span>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s, i) => {
              const locked = !canSegmented && i > 1;
              return (
                <span
                  key={s}
                  className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-caption ${
                    locked
                      ? "border-border-subtle text-text-muted"
                      : "border-border text-text-2 hover:border-accent"
                  }`}
                >
                  {locked && <Lock size={12} />}
                  {s}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-text-2">Mensagem</span>
          <textarea
            rows={3}
            defaultValue="Sentimos sua falta! Que tal agendar seu próximo corte com 10% off? 💈"
            className="rounded-md border border-border bg-inset p-3 text-body text-text placeholder:text-text-muted focus-visible:border-focus focus-visible:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-caption text-text-muted">
            Alcance estimado: <strong className="text-text">37 clientes</strong> · WhatsApp + e-mail
          </span>
          <Button>Enviar campanha</Button>
        </div>
      </div>

      {/* Lista de campanhas */}
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
            {CAMPAIGNS.map((c) => (
              <tr key={c.id} className="border-b border-border-subtle">
                <td className="px-4 py-3 text-text">{c.name}</td>
                <td className="px-4 py-3 text-text-2">{c.segment}</td>
                <td className="px-4 py-3 text-text tabular">{c.reach}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

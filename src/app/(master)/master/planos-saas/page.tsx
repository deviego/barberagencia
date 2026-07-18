import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS, hasEntitlement, getLimit, type FeatureKey } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { formatBRL } from "@/lib/utils";

const ORDER: SaasPlanKey[] = ["essencial", "profissional", "advanced"];

const FEATURE_ROWS: { key: FeatureKey; label: string }[] = [
  { key: "site.subdomain", label: "Site em subdomínio" },
  { key: "site.customDomain", label: "Domínio próprio" },
  { key: "support.desk", label: "Central de atendimento" },
  { key: "whatsapp.automation", label: "Automação de WhatsApp" },
  { key: "whatsapp.chatbot", label: "Chatbot no WhatsApp" },
  { key: "marketing.basic", label: "Marketing (campanhas)" },
  { key: "marketing.segmented", label: "Campanhas segmentadas" },
  { key: "network.multiUnit", label: "Multi-unidades (rede)" },
];

export default function PlanosSaasPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Planos SaaS</h1>

      {/* Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {ORDER.map((key) => {
          const plan = PLANS[key];
          const featured = key === "profissional";
          const clients = getLimit(key, "clients.limit");
          return (
            <div
              key={key}
              className={`flex flex-col gap-4 rounded-lg border bg-surface p-6 ${
                featured ? "border-2 border-accent" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-h4 uppercase text-text">{plan.label}</span>
                {featured && <Badge variant="accent">Popular</Badge>}
              </div>
              <div className="text-h1 text-accent tabular">
                {formatBRL(plan.priceBRL)}
                <span className="text-body text-text-muted">/mês</span>
              </div>
              <div className="text-caption text-text-muted">
                {clients === -1 ? "Clientes ilimitados" : `${clients} clientes`}
              </div>
              <ul className="flex flex-col gap-2 text-body">
                {FEATURE_ROWS.filter((f) => hasEntitlement(key, f.key)).map((f) => (
                  <li key={f.key} className="flex items-center gap-2 text-text-2">
                    <Check size={16} className="text-success-strong" />
                    {f.label}
                  </li>
                ))}
              </ul>
              <Button variant={featured ? "primary" : "outline"} className="mt-auto">
                Selecionar
              </Button>
            </div>
          );
        })}
      </div>

      {/* Tabela comparativa */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-caption uppercase text-text-muted">
              <th className="px-4 py-3 text-left font-semibold">Recurso</th>
              {ORDER.map((k) => (
                <th key={k} className="px-4 py-3 text-center font-semibold">
                  {PLANS[k].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((f) => (
              <tr key={f.key} className="border-b border-border-subtle">
                <td className="px-4 py-3 text-text-2">{f.label}</td>
                {ORDER.map((k) => (
                  <td key={k} className="px-4 py-3 text-center">
                    {hasEntitlement(k, f.key) ? (
                      <Check size={16} className="mx-auto text-success-strong" />
                    ) : (
                      <Minus size={16} className="mx-auto text-text-muted" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

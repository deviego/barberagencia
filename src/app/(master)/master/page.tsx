import Link from "next/link";
import { EllipsisVertical, Palette, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { TENANTS } from "@/features/platform/mock-data";

const STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  ACTIVE: { label: "Ativa", variant: "success" },
  PAYMENT_PENDING: { label: "Pagamento pendente", variant: "warning" },
  ONBOARDING: { label: "Onboarding", variant: "info" },
  SUSPENDED: { label: "Suspensa", variant: "danger" },
};

export default function BarbeariasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-bold text-text">Barbearias</h1>
        <Link href="/master/onboarding">
          <Button>
            <Plus size={16} />
            Nova barbearia
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              <th className="px-4 py-3 font-semibold">Barbearia</th>
              <th className="px-4 py-3 font-semibold">Domínio</th>
              <th className="px-4 py-3 font-semibold">Plano SaaS</th>
              <th className="px-4 py-3 font-semibold">Unidades</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {TENANTS.map((t) => (
              <tr key={t.id} className="border-b border-border-subtle transition-colors hover:bg-accent-wash">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-md font-display text-caption font-black"
                      style={{ background: t.color, color: t.logoFg }}
                    >
                      {t.logo}
                    </span>
                    <span className="text-text">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-2">{t.domain}</td>
                <td className="px-4 py-3">
                  <Badge variant="accent">{PLANS[t.plan as SaasPlanKey].label}</Badge>
                </td>
                <td className="px-4 py-3 text-text tabular">{t.units}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS[t.status].variant}>{STATUS[t.status].label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Link
                      href="/master/temas"
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent-wash hover:text-accent"
                      aria-label="Editar tema"
                    >
                      <Palette size={16} />
                    </Link>
                    <button
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent-wash hover:text-accent"
                      aria-label="Mais ações"
                    >
                      <EllipsisVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnterAdminButton } from "@/features/platform/components/enter-admin-button";
import { getTenants } from "@/features/platform/data";
import { formatBRL } from "@/lib/utils";

const PLAN_LABEL: Record<string, string> = {
  personal: "Personal",
  essencial: "Essencial",
  advance: "Advance",
};

export default async function BarbeariasPage() {
  const tenants = await getTenants();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h3 font-bold text-text">Barbearias</h1>
          <p className="text-caption text-text-muted">{tenants.length} na plataforma — clique para ver o detalhe</p>
        </div>
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
              <th className="px-4 py-3 font-semibold">Link</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Clientes</th>
              <th className="px-4 py-3 font-semibold">Assinantes</th>
              <th className="px-4 py-3 font-semibold">Faturamento (mês)</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-border-subtle transition-colors hover:bg-accent-wash">
                <td className="px-4 py-3">
                  <Link href={`/master/barbearias/${t.id}`} className="font-semibold text-text hover:text-accent hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-2 tabular">/b/{t.subdomain}</td>
                <td className="px-4 py-3">
                  <Badge variant="accent">{PLAN_LABEL[t.saasPlan] ?? t.saasPlan}</Badge>
                </td>
                <td className="px-4 py-3 text-text tabular">{t.clients}</td>
                <td className="px-4 py-3 text-text tabular">{t.subscribers}</td>
                <td className="px-4 py-3 text-text tabular">{formatBRL(t.revenueMonth)}</td>
                <td className="px-4 py-3">
                  <Badge variant={t.status === "ACTIVE" ? "success" : "warning"}>
                    {t.status === "ACTIVE" ? "Ativa" : t.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <EnterAdminButton tenantId={t.id} label="Acessar" variant="outline" size="sm" />
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                  Nenhuma barbearia ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

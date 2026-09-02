import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDistributors } from "@/features/distributor/data";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  ACTIVE: { label: "Ativo", variant: "success" },
  PAYMENT_PENDING: { label: "Pgto pendente", variant: "warning" },
  SUSPENDED: { label: "Suspenso", variant: "danger" },
  ONBOARDING: { label: "Onboarding", variant: "neutral" },
};

export default async function DistribuidoresPage() {
  const rows = await getDistributors();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h3 font-bold text-text">Distribuidores</h1>
          <p className="text-caption text-text-muted">Revendedores de produtos assinantes da plataforma.</p>
        </div>
        <Link href="/master/onboarding-distribuidor">
          <Button>
            <Plus size={16} /> Novo distribuidor
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              <th className="px-4 py-3 font-semibold">Distribuidor</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-muted">Nenhum distribuidor cadastrado ainda.</td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-b border-border-subtle hover:bg-accent-wash/40">
                  <td className="px-4 py-3">
                    <Link href={`/master/distribuidores/${d.id}`} className="font-semibold text-text hover:text-accent">{d.name}</Link>
                    <div className="text-caption text-text-muted">/{d.subdomain}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="accent">{d.planLabel}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={(STATUS[d.status] ?? STATUS.ACTIVE).variant}>{(STATUS[d.status] ?? STATUS.ACTIVE).label}</Badge></td>
                  <td className="px-4 py-3 text-right text-text-2 tabular">{new Date(d.createdAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

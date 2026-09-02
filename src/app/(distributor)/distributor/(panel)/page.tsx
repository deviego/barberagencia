import { getCurrentTenant } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export default async function DistributorDashboard() {
  const tenant = await getCurrentTenant();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Painel do distribuidor</h1>
        <p className="text-caption text-text-muted">Bem-vindo, {tenant.name}.</p>
      </div>
      <div className="rounded-lg border border-border bg-surface p-6 text-body text-text-2">
        Seu painel está sendo montado: em breve você terá aqui o resumo de vendas, pedidos e estoque.
        Use o menu para gerenciar seu catálogo, sua carteira de clientes e seus pedidos.
      </div>
    </div>
  );
}

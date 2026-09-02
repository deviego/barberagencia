import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { getPartnerDetail, listTenantsMini, type PartnerType } from "@/features/partners/data";
import { PartnerForm } from "@/features/partners/components/partner-form";
import { CopyLink } from "@/features/partners/components/copy-link";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<PartnerType, string> = { EMBAIXADORA: "Embaixadora", DIVULGADORA: "Divulgadora", DISTRIBUIDOR: "Distribuidor" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativa", ONBOARDING: "Onboarding", PAYMENT_PENDING: "Pgto pendente", SUSPENDED: "Suspensa" };

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, tenants] = await Promise.all([getPartnerDetail(id), listTenantsMini()]);
  if (!p) notFound();

  const commissionKpi =
    p.commissionKind === "NONE" ? "—" : `${formatBRL(p.estimatedCommission)}${p.commissionPeriod === "mês" ? "/mês" : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/master/parceiros" className="flex items-center gap-1.5 text-caption text-text-muted hover:text-text">
        <ArrowLeft size={15} /> Parceiros
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-h3 font-bold text-text">{p.name}</h1>
        <Badge variant="accent">{TYPE_LABEL[p.type]}</Badge>
        <Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
        {p.tenantName && <span className="text-caption text-text-muted">Barbearia: {p.tenantName}</span>}
      </div>

      {/* Link de afiliado */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent-wash px-5 py-4">
        <div className="min-w-0">
          <div className="text-caption text-text-muted">Link de afiliado (o parceiro divulga este link)</div>
          <div className="truncate font-semibold text-text">{p.affiliateLink}</div>
        </div>
        <CopyLink value={p.affiliateLink} />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Barbearias indicadas" value={String(p.referredCount)} accent />
        <KpiCard label="Ativas" value={String(p.activeCount)} tone="success" />
        <KpiCard label="Comissão estimada" value={commissionKpi} />
      </div>

      {/* Barbearias indicadas */}
      <section className="flex flex-col gap-3">
        <h2 className="text-h5 font-bold text-text">Barbearias indicadas</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
                <th className="px-4 py-3 font-semibold">Barbearia</th>
                <th className="px-4 py-3 font-semibold">Plano</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Entrou em</th>
              </tr>
            </thead>
            <tbody>
              {p.referredTenants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-muted">Nenhuma barbearia veio por este parceiro ainda.</td>
                </tr>
              ) : (
                p.referredTenants.map((t) => (
                  <tr key={t.id} className="border-b border-border-subtle">
                    <td className="px-4 py-3">
                      <Link href={`/master/barbearias/${t.id}`} className="text-text hover:text-accent">{t.name}</Link>
                    </td>
                    <td className="px-4 py-3"><Badge variant="accent">{t.planLabel}</Badge></td>
                    <td className="px-4 py-3 text-text-2">{STATUS_LABEL[t.status] ?? t.status}</td>
                    <td className="px-4 py-3 text-right text-text-2 tabular">{new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Editar dados do parceiro */}
      <section className="flex flex-col gap-3">
        <h2 className="text-h5 font-bold text-text">Editar parceiro</h2>
        <PartnerForm tenants={tenants} initial={p} />
      </section>
    </div>
  );
}

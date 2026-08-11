import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { BarChart } from "@/features/platform/components/bar-chart";
import { EnterAdminButton } from "@/features/platform/components/enter-admin-button";
import { getTenantDetail } from "@/features/platform/data";
import { getTenantContractById } from "@/features/contract/data";
import { buildContractView, PLAN_LABEL as CONTRACT_PLAN_LABEL } from "@/features/contract/view";
import { MasterContractPanel } from "@/features/contract/components/master-contract-panel";
import { getUpgradeRequestsForTenant } from "@/features/plan/data";
import { MasterPlanPanel } from "@/features/plan/components/master-plan-panel";
import { getQueueConfig } from "@/features/queue/data";
import { QueueEnableToggle } from "@/features/queue/components/queue-enable-toggle";
import { formatBRL } from "@/lib/utils";

const PLAN_LABEL: Record<string, string> = {
  personal: "Personal",
  essencial: "Essencial",
  advance: "Advance",
};

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, contract, upgradeReqs, queueConfig] = await Promise.all([
    getTenantDetail(id),
    getTenantContractById(id),
    getUpgradeRequestsForTenant(id),
    getQueueConfig(id),
  ]);
  if (!t) notFound();
  const contractView = buildContractView(contract);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/master/barbearias" className="flex items-center gap-1.5 text-caption text-text-muted hover:text-text">
        <ArrowLeft size={15} /> Barbearias
      </Link>

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-accent-wash font-display text-h4 font-black text-accent">
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt={t.name} className="h-full w-full object-cover" />
            ) : (
              t.logoText ?? t.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-h3 font-bold text-text">{t.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="accent">{PLAN_LABEL[t.saasPlan] ?? t.saasPlan}</Badge>
              <Badge variant={t.status === "ACTIVE" ? "success" : "warning"}>
                {t.status === "ACTIVE" ? "Ativa" : t.status}
              </Badge>
              <span className="text-caption text-text-muted">Criada em {format(new Date(t.createdAt), "dd/MM/yyyy")}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <EnterAdminButton tenantId={t.id} label="Acessar painel admin" />
          <Link
            href={`/b/${t.subdomain}`}
            target="_blank"
            className="flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline"
          >
            /b/{t.subdomain} <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {(t.phone || t.address) && (
        <div className="flex flex-wrap gap-5 text-caption text-text-2">
          {t.phone && (
            <span className="flex items-center gap-1.5">
              <Phone size={14} className="text-text-muted" /> {t.phone}
            </span>
          )}
          {t.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-text-muted" /> {t.address}
            </span>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Faturamento (mês)" value={formatBRL(t.revenueMonth)} accent />
        <KpiCard label="Faturamento (total)" value={formatBRL(t.revenueTotal)} />
        <KpiCard label="Assinantes ativos" value={String(t.counts.subscribers)} tone="success" />
        <KpiCard label="Clientes" value={String(t.counts.clients)} />
        <KpiCard label="Serviços" value={String(t.counts.services)} />
        <KpiCard label="Produtos" value={String(t.counts.products)} />
      </div>

      <BarChart title="Faturamento — 6 meses" data={t.revenue6m} format={formatBRL} />

      {/* Serviços */}
      <Section title="Serviços" count={t.counts.services}>
        {t.services.length === 0 ? (
          <Empty>Nenhum serviço cadastrado.</Empty>
        ) : (
          <Table head={["Serviço", "Duração", "Preço", "Status"]}>
            {t.services.map((s) => (
              <tr key={s.id} className="border-b border-border-subtle">
                <td className="px-4 py-2.5 text-text">{s.name}</td>
                <td className="px-4 py-2.5 text-text-2 tabular">{s.durationMin} min</td>
                <td className="px-4 py-2.5 text-text tabular">{formatBRL(s.priceBrl)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Ativo" : "Inativo"}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {/* Produtos */}
      <Section title="Produtos" count={t.counts.products}>
        {t.products.length === 0 ? (
          <Empty>Nenhum produto cadastrado.</Empty>
        ) : (
          <Table head={["Produto", "Estoque", "Preço", "Status"]}>
            {t.products.map((p) => (
              <tr key={p.id} className="border-b border-border-subtle">
                <td className="px-4 py-2.5 text-text">{p.name}</td>
                <td className="px-4 py-2.5 text-text-2 tabular">{p.stock}</td>
                <td className="px-4 py-2.5 text-text tabular">{formatBRL(p.priceBrl)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {/* Assinantes */}
      <Section title="Assinantes" count={t.counts.subscribers}>
        {t.subscribers.length === 0 ? (
          <Empty>Nenhum assinante ativo.</Empty>
        ) : (
          <Table head={["Cliente", "Plano", "Mensalidade"]}>
            {t.subscribers.map((sub) => (
              <tr key={sub.id} className="border-b border-border-subtle">
                <td className="px-4 py-2.5 text-text">{sub.clientName}</td>
                <td className="px-4 py-2.5 text-text-2">{sub.planName}</td>
                <td className="px-4 py-2.5 text-text tabular">{formatBRL(sub.priceBrl)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <MasterPlanPanel tenantId={t.id} plan={t.saasPlan} requests={upgradeReqs} />

      <QueueEnableToggle tenantId={t.id} enabled={queueConfig.enabled} />

      {contractView && (
        <MasterContractPanel
          tenantId={t.id}
          view={contractView}
          planLabel={contract?.plan ? CONTRACT_PLAN_LABEL[contract.plan] ?? contract.plan : null}
          initial={{
            legalName: contract?.legal_name ?? "",
            tradeName: contract?.trade_name ?? t.name,
            docType: (contract?.doc_type as "CNPJ" | "CPF") ?? "CNPJ",
            docNumber: contract?.doc_number ?? "",
            responsibleName: contract?.responsible_name ?? "",
            responsibleCpf: contract?.responsible_cpf ?? "",
            addressStreet: contract?.address_street ?? "",
            addressCity: contract?.address_city ?? "",
            addressState: contract?.address_state ?? "",
            addressZip: contract?.address_zip ?? "",
          }}
        />
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-h5 font-bold text-text">{title}</h2>
        <Badge variant="neutral">{count}</Badge>
      </div>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-border-subtle px-4 py-6 text-center text-caption text-text-muted">{children}</p>;
}

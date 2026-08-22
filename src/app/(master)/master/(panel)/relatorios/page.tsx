import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonthlyReport } from "@/features/platform/report";
import { SendReportButton } from "@/features/platform/components/send-report-button";
import { PLAN_LABEL } from "@/features/contract/view";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const r = await getMonthlyReport();
  const p = r.platform;

  return (
    <div className="flex flex-col gap-6" id="report">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h3 font-bold text-text">Relatório mensal</h1>
          <p className="text-caption text-text-muted">
            Barber Agência · <span className="capitalize">{r.period.label}</span> · consolidado da plataforma
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 print:hidden">
          <a href="/api/master/report/pdf" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <Download size={16} /> Baixar PDF
            </Button>
          </a>
          <SendReportButton />
        </div>
      </div>

      {/* KPIs da plataforma */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Entradas" value={formatBRL(p.entradas)} tone="success" />
        <Kpi label="Saídas" value={formatBRL(p.saidas)} tone="danger" />
        <Kpi label="Resultado (líquido)" value={formatBRL(p.liquido)} accent />
        <Kpi label="Barbearias" value={`${p.barbershops}`} sub={`${p.activeBarbershops} ativas`} />
        <Kpi label="Clientes cadastrados" value={`${p.clients}`} sub={`+${p.newClients} no mês`} />
        <Kpi label="Assinantes ativos" value={`${p.subscribers}`} />
        <Kpi label="Planos das barbearias" value={`${p.byPlan.advance}·${p.byPlan.essencial}·${p.byPlan.personal}`} sub="Adv·Ess·Per" />
      </section>

      {/* Entradas por método + Top clientes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Entradas por método">
          {p.byMethod.length ? (
            <Table head={["Método", "Total"]}>
              {p.byMethod.map((m) => (
                <tr key={m.method} className="border-b border-border-subtle">
                  <td className="px-4 py-2 text-text">{m.method}</td>
                  <td className="px-4 py-2 text-right text-text tabular">{formatBRL(m.total)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Sem entradas no período.</Empty>
          )}
        </Panel>

        <Panel title="Receita por cliente (top 15)">
          {p.topClients.length ? (
            <Table head={["Cliente", "Barbearia", "Receita"]}>
              {p.topClients.map((c, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td className="px-4 py-2 text-text">{c.name}</td>
                  <td className="px-4 py-2 text-text-2">{c.tenantName}</td>
                  <td className="px-4 py-2 text-right text-text tabular">{formatBRL(c.total)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Sem receita por cliente no período.</Empty>
          )}
        </Panel>
      </div>

      {/* Faturamento por serviço */}
      <Panel title="Faturamento por serviço">
        {r.byService.length ? (
          <Table head={["Serviço", "Qtd", "Valor"]}>
            {r.byService.map((s, i) => (
              <tr key={i} className="border-b border-border-subtle">
                <td className="px-4 py-2 text-text">{s.name}</td>
                <td className="px-4 py-2 text-right text-text-2 tabular">{s.qty}</td>
                <td className="px-4 py-2 text-right text-text tabular">{formatBRL(s.value)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Sem serviços registrados no período.</Empty>
        )}
      </Panel>

      {/* Por barbearia */}
      <Panel title="Por barbearia">
        <Table head={["Barbearia", "Plano", "Clientes", "Novos", "Assinantes", "Entradas", "Saídas"]}>
          {r.perBarbershop.map((b) => (
            <tr key={b.id} className="border-b border-border-subtle">
              <td className="px-4 py-2 text-text">{b.name}</td>
              <td className="px-4 py-2 text-text-2">{PLAN_LABEL[b.plan] ?? b.plan}</td>
              <td className="px-4 py-2 text-right text-text-2 tabular">{b.clients}</td>
              <td className="px-4 py-2 text-right text-text-2 tabular">{b.newClients}</td>
              <td className="px-4 py-2 text-right text-text-2 tabular">{b.subscribers}</td>
              <td className="px-4 py-2 text-right text-text tabular">{formatBRL(b.entradas)}</td>
              <td className="px-4 py-2 text-right text-text-2 tabular">{formatBRL(b.saidas)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <p className="text-caption text-text-muted print:hidden">
        Dica: em “Baixar PDF”, escolha “Salvar como PDF” no destino da impressão. Geografia dos clientes e
        prospecções ainda não são coletadas — ficam de fora deste relatório.
      </p>

      {/* Impressão limpa: mostra só o relatório */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #report, #report * { visibility: visible !important; }
        #report { position: absolute; left: 0; top: 0; width: 100%; padding: 12px; }
      }`}</style>
    </div>
  );
}

function Kpi({ label, value, sub, tone, accent }: { label: string; value: string; sub?: string; tone?: "success" | "danger"; accent?: boolean }) {
  const color = tone === "success" ? "text-success-strong" : tone === "danger" ? "text-danger" : accent ? "text-accent" : "text-text";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-caption text-text-muted">{label}</div>
      <div className={`mt-1 font-display text-h3 font-black tabular ${color}`}>{value}</div>
      {sub && <div className="text-caption text-text-muted">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h5 font-bold text-text">{title}</h2>
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
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-2.5 font-semibold ${i === 0 ? "" : "text-right"}`}>
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

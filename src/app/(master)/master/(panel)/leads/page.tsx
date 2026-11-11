import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getLeads, parseLeadOrigem } from "@/features/leads/data";
import { LEAD_ORIGENS, type LeadStatus } from "@/features/leads/rate-limit";
import { ORDER_CHANNEL_LABELS, type OrderChannel } from "@/features/leads/schema";
import { LeadRowActions } from "./lead-row-actions";

export const dynamic = "force-dynamic";

const ORIGEM_LABEL: Record<string, string> = { "landing-distribuidora": "Landing distribuidoras" };

const STATUS: Record<LeadStatus, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  NEW: { label: "Novo", variant: "accent" },
  CONTACTED: { label: "Contatado", variant: "success" },
  DISCARDED: { label: "Descartado", variant: "neutral" },
};

function formatWhatsapp(digits: string): string {
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const { origem: raw } = await searchParams;
  const origem = parseLeadOrigem(raw);
  const rows = await getLeads(origem);

  const filters = [{ value: null, label: "Todas" }, ...LEAD_ORIGENS.map((o) => ({ value: o, label: ORIGEM_LABEL[o] ?? o }))];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Leads</h1>
        <p className="text-caption text-text-muted">
          Contatos deixados nos formulários do site. Nenhuma mensagem sai automaticamente: quem chama é a equipe.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f.value === origem;
          return (
            <Link
              key={f.label}
              href={f.value ? `/master/leads?origem=${f.value}` : "/master/leads"}
              className={`rounded-full border px-3 py-1 text-caption ${active ? "border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:text-accent"}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              <th className="px-4 py-3 font-semibold">Contato</th>
              <th className="px-4 py-3 font-semibold">Cidade</th>
              <th className="px-4 py-3 font-semibold">Barbearias</th>
              <th className="px-4 py-3 font-semibold">Pedidos hoje</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-muted">Nenhum lead ainda.</td>
              </tr>
            ) : (
              rows.map((l) => {
                const anonymized = !!l.anonymized_at;
                const st = STATUS[l.status] ?? STATUS.NEW;
                return (
                  <tr key={l.id} className="border-b border-border-subtle align-top">
                    <td className="px-4 py-3">
                      {anonymized ? (
                        <span className="text-text-muted">Anonimizado em {new Date(l.anonymized_at!).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                      ) : (
                        <>
                          <div className="font-semibold text-text">{l.name}</div>
                          <div className="text-caption text-text-2">{l.company}</div>
                          {l.whatsapp && (
                            <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-caption text-accent hover:underline">
                              {formatWhatsapp(l.whatsapp)}
                            </a>
                          )}
                        </>
                      )}
                      <div className="mt-1 text-caption text-text-muted">
                        {ORIGEM_LABEL[l.origem] ?? l.origem} ·{" "}
                        {new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-2">{[l.city, l.state].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-4 py-3 text-text-2 tabular">{l.barbershops_count ?? "—"}</td>
                    <td className="px-4 py-3 text-text-2">{l.order_channel ? ORDER_CHANNEL_LABELS[l.order_channel as OrderChannel] ?? l.order_channel : "—"}</td>
                    <td className="px-4 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                    <td className="px-4 py-3">
                      <LeadRowActions id={l.id} status={l.status} anonymized={anonymized} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

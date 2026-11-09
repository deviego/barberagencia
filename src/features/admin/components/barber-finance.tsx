"use client";

import { useMemo, useState } from "react";
import { Users, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL, cn } from "@/lib/utils";
import type { BarberFinanceRow, BarberReceipt } from "@/features/admin/data";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CARD_CREDIT: "Cartão",
  CARD_DEBIT: "Cartão",
  CASH: "Dinheiro",
  PLAN: "Plano",
};

/** Faturamento por barbeiro no período: equipe inteira ou um barbeiro específico. */
export function BarberFinance({ barbers, detailed }: { barbers: BarberFinanceRow[]; detailed: BarberReceipt[] }) {
  const [selected, setSelected] = useState<string>("team"); // "team" ou barberId

  const teamRevenue = useMemo(() => barbers.reduce((s, b) => s + b.revenue, 0), [barbers]);
  const rows = useMemo(
    () => (selected === "team" ? detailed : detailed.filter((d) => d.barberId === selected)),
    [selected, detailed]
  );
  const selBarber = barbers.find((b) => b.id === selected) ?? null;
  const selRevenue = selected === "team" ? teamRevenue : selBarber?.revenue ?? 0;
  const selAppts = selected === "team" ? detailed.length : selBarber?.appts ?? 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2 text-overline uppercase text-text-muted">
        <Users size={14} /> Faturamento por barbeiro
      </div>

      {/* Seletor: Equipe + barbeiros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelected("team")}
          className={cn(
            "rounded-pill border px-3.5 py-1.5 text-caption transition-colors",
            selected === "team" ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
          )}
        >
          Equipe inteira
        </button>
        {barbers.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelected(b.id)}
            className={cn(
              "rounded-pill border px-3.5 py-1.5 text-caption transition-colors",
              selected === b.id ? "border-2 border-accent bg-accent-wash text-accent" : "border-border text-text-2 hover:border-accent"
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Resumo do selecionado */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md bg-inset px-4 py-3">
        <div>
          <div className="text-caption uppercase text-text-muted">Faturamento</div>
          <div className="text-h4 font-bold text-accent tabular">{formatBRL(selRevenue)}</div>
        </div>
        <div>
          <div className="text-caption uppercase text-text-muted">Atendimentos</div>
          <div className="text-h4 font-bold text-text tabular">{selAppts}</div>
        </div>
      </div>

      {/* Visão equipe: ranking por barbeiro */}
      {selected === "team" && barbers.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelected(b.id)}
              className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2.5 text-left transition hover:border-accent"
            >
              <span className="flex items-center gap-2 text-body text-text">
                <Scissors size={14} className="text-accent" /> {b.name}
              </span>
              <span className="flex items-center gap-3 text-caption text-text-muted">
                <span className="tabular">{b.appts} atend.</span>
                <span className="text-body font-semibold text-success-strong tabular">{formatBRL(b.revenue)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Recebimentos detalhados (cliente + serviços) */}
      <div className="text-caption font-semibold text-text-2">
        {selected === "team" ? "Atendimentos da equipe" : `Atendimentos de ${selBarber?.name ?? "—"}`}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-caption text-text-muted">Nenhum atendimento no período.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {rows.slice(0, 60).map((r, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body font-semibold text-text">{r.clientName}</span>
                  <span className="text-caption text-text-muted tabular">{new Date(r.datetime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="truncate text-caption text-text-muted">
                  {r.items.length ? r.items.map((it) => `${it.qty > 1 ? it.qty + "× " : ""}${it.name}`).join(" · ") : "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {r.method && <Badge variant="neutral">{METHOD_LABEL[r.method] ?? "Outros"}</Badge>}
                <span className="text-body font-semibold text-success-strong tabular">{formatBRL(r.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

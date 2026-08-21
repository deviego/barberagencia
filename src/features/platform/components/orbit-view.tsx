"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBRL } from "@/lib/utils";
import { planLabel, normalizeSaasPlan } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";

export type OrbitTenant = {
  id: string;
  name: string;
  saasPlan: string;
  subscribers: number;
  revenueMonth: number;
  status?: string;
};

/** Anéis por plano: Advance (interno) → Essencial → Personal (externo). */
const RINGS: { plan: SaasPlanKey; radius: number }[] = [
  { plan: "advance", radius: 21 },
  { plan: "essencial", radius: 33 },
  { plan: "personal", radius: 45 },
];

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "BB";
}

/**
 * Dashboard em "órbita": Barber Agência no centro e as barbearias orbitando
 * em anéis por plano. Clicar num satélite abre o detalhe da barbearia.
 */
export function OrbitView({
  centerLabel,
  barbershops,
  mrr,
  tenants,
}: {
  centerLabel: string;
  barbershops: number;
  mrr: number;
  tenants: OrbitTenant[];
}) {
  const [hover, setHover] = useState<string | null>(null);

  const groups = RINGS.map((r) => ({
    ...r,
    items: tenants.filter((t) => normalizeSaasPlan(t.saasPlan) === r.plan),
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Legenda dos anéis */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-text-2">
        {RINGS.map((r) => {
          const n = groups.find((g) => g.plan === r.plan)?.items.length ?? 0;
          return (
            <span key={r.plan} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" style={{ opacity: r.plan === "advance" ? 1 : r.plan === "essencial" ? 0.6 : 0.35 }} />
              {planLabel(r.plan)} · <strong className="tabular text-text">{n}</strong>
            </span>
          );
        })}
      </div>

      {/* Palco orbital */}
      <div className="relative mx-auto aspect-square w-full max-w-[680px]">
        {/* Anéis-guia */}
        {RINGS.map((r) => (
          <div
            key={r.plan}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border-subtle"
            style={{ width: `${r.radius * 2}%`, height: `${r.radius * 2}%` }}
          />
        ))}

        {/* Centro — Barber Agência */}
        <div className="absolute left-1/2 top-1/2 z-10 flex h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-accent text-center text-text-inverse shadow-lg">
          <span className="font-display text-h4 font-black leading-none">{centerLabel}</span>
          <span className="mt-1 font-display text-h3 font-black leading-none tabular">{barbershops}</span>
          <span className="text-[11px] uppercase tracking-wide opacity-90">barbearias</span>
          <span className="mt-0.5 text-caption tabular opacity-90">{formatBRL(mrr)}/mês</span>
        </div>

        {/* Satélites (barbearias) */}
        {groups.map((g) =>
          g.items.map((t, i) => {
            const ang = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, g.items.length);
            const x = 50 + g.radius * Math.cos(ang);
            const y = 50 + g.radius * Math.sin(ang);
            const active = hover === t.id;
            return (
              <Link
                key={t.id}
                href={`/master/barbearias/${t.id}`}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-surface font-display text-body font-bold transition-transform ${
                    active ? "scale-110 border-accent text-accent shadow-md" : "border-border text-text-2"
                  }`}
                >
                  {initials(t.name)}
                </span>
                <span className="max-w-[110px] truncate rounded-pill bg-surface/90 px-2 text-caption font-semibold text-text">
                  {t.name}
                </span>
                <span className="text-[11px] tabular text-text-muted">{formatBRL(t.revenueMonth)}</span>
              </Link>
            );
          })
        )}

        {tenants.length === 0 && (
          <div className="absolute inset-x-0 bottom-2 text-center text-caption text-text-muted">
            Nenhuma barbearia ainda — crie a primeira em “Nova barbearia”.
          </div>
        )}
      </div>
    </div>
  );
}

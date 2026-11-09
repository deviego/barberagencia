"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES = [
  ["day", "Dia"],
  ["week", "Semana"],
  ["month", "Mês"],
] as const;

/** Filtro de período do Financeiro: Dia (padrão) / Semana / Mês + data específica. */
export function FinanceFilter({ range, date }: { range: "day" | "week" | "month"; date: string }) {
  const router = useRouter();
  const go = (r: string, d: string) => router.push(`/admin/financeiro?range=${r}&date=${d}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-border p-0.5">
        {RANGES.map(([r, label]) => (
          <button
            key={r}
            onClick={() => go(r, date)}
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-caption transition-colors",
              range === r ? "bg-accent-wash font-semibold text-accent" : "text-text-2 hover:text-text"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(range, e.target.value)}
        className="h-9 rounded-md border border-border bg-inset px-2 text-caption text-text focus:border-accent focus:outline-none"
      />
    </div>
  );
}

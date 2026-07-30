import type { Bar } from "@/features/platform/data";

/** Gráfico de barras simples (mesmo padrão do dashboard admin), sem libs. */
export function BarChart({
  title,
  data,
  format,
}: {
  title: string;
  data: Bar[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((m) => m.value));
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 text-overline uppercase text-text-muted">{title}</div>
      <div className="flex h-48 items-end gap-3">
        {data.map((m, i) => (
          <div key={`${m.month}-${i}`} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-caption tabular text-text-2">{format ? format(m.value) : m.value}</span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${(m.value / max) * 100}%`,
                background: m.current ? "var(--bb-accent)" : "var(--bb-n700)",
                minHeight: 2,
              }}
            />
            <span className="text-caption uppercase text-text-muted">{m.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

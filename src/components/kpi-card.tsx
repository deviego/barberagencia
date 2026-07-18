import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="text-overline uppercase text-text-muted">{label}</div>
      <div className={cn("mt-1 text-h2 tabular", accent ? "text-accent" : "text-text")}>{value}</div>
      {delta && <div className="mt-1 text-caption text-success-strong">{delta}</div>}
    </div>
  );
}

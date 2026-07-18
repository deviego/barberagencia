import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "success" | "danger";

const TONE: Record<Tone, string> = {
  default: "text-text",
  accent: "text-accent",
  success: "text-success-strong",
  danger: "text-danger",
};

export function KpiCard({
  label,
  value,
  delta,
  accent,
  tone,
}: {
  label: string;
  value: string;
  delta?: string;
  /** atalho legado equivalente a tone="accent" */
  accent?: boolean;
  tone?: Tone;
}) {
  const resolved: Tone = tone ?? (accent ? "accent" : "default");
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="text-overline uppercase text-text-muted">{label}</div>
      <div className={cn("mt-1 text-h2 tabular", TONE[resolved])}>{value}</div>
      {delta && <div className="mt-1 text-caption text-success-strong">{delta}</div>}
    </div>
  );
}

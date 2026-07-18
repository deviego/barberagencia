import { cn } from "@/lib/utils";

/**
 * Medidor de cortes (saldo do combo) — anel de progresso via conic-gradient.
 * Ex.: 3/4 cortes restantes no mês.
 */
export function CutMeter({
  remaining,
  total,
  size = 132,
  className,
}: {
  remaining: number;
  total: number;
  size?: number;
  className?: string;
}) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const ring = 12;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(var(--bb-accent) ${pct}%, var(--bb-n700) ${pct}% 100%)`,
      }}
      role="img"
      aria-label={`${remaining} de ${total} cortes restantes`}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-surface"
        style={{ width: size - ring * 2, height: size - ring * 2 }}
      >
        <span className="font-display text-h2 leading-none text-text tabular">
          {remaining}/{total}
        </span>
        <span className="mt-1 text-overline uppercase text-text-muted">cortes</span>
      </div>
    </div>
  );
}

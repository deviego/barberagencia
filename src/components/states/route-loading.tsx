import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-elevated motion-safe:animate-pulse", className)} />;
}

export interface RouteLoadingProps {
  /**
   * panel: painéis (admin, master, distribuidor, rede) — título, KPIs e lista.
   * mobile: telas do cliente e links públicos — coluna única, cartões grandes.
   */
  variant?: "panel" | "mobile";
  fullScreen?: boolean;
}

/** Skeleton leve compartilhado pelos loading.tsx. Só tokens do design system. */
export function RouteLoading({ variant = "panel", fullScreen = false }: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("w-full", fullScreen && "min-h-screen", variant === "mobile" ? "mx-auto max-w-md px-4 py-6" : "p-4 md:p-6")}
    >
      <span className="sr-only">Carregando…</span>
      {variant === "panel" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Bone className="h-8 w-48" />
            <Bone className="h-4 w-72 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Bone key={i} className="h-10" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Bone className="h-7 w-40" />
          <Bone className="h-4 w-56 max-w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Bone key={i} className="h-20 rounded-lg" />
          ))}
          <Bone className="h-12 w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

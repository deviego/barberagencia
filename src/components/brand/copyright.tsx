import { cn } from "@/lib/utils";

/** Crédito discreto da plataforma. Renderizado no servidor (sem risco de hidratação). */
export function Copyright({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <p className={cn("text-center text-caption text-text-muted", className)}>
      © {year} <span className="font-semibold">barberagencia</span>
    </p>
  );
}

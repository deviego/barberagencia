import { cn } from "@/lib/utils";

/** Bloco de logo do tenant (placeholder tipográfico até haver imagem). */
export function LogoMark({
  text,
  size = 34,
  className,
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-accent font-display font-black text-text-inverse",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.53 }}
    >
      {text}
    </div>
  );
}

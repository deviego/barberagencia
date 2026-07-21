import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo do tenant. Se `src` (logoUrl) existir, mostra a imagem; senão, o
 * placeholder tipográfico com as iniciais.
 */
export function LogoMark({
  text,
  src,
  size = 34,
  className,
}: {
  text: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <span
        className={cn("relative block shrink-0 overflow-hidden rounded-md", className)}
        style={{ height: size, width: size }}
      >
        <Image src={src} alt={text} fill sizes={`${size}px`} className="object-contain" />
      </span>
    );
  }
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

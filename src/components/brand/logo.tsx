"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { isPublicStorageUrl } from "@/lib/storage/public-url";

/**
 * Logo do tenant. Só usa next/image quando `src` é uma URL pública do nosso Storage
 * (o único host liberado em images.remotePatterns). Qualquer outra URL, ou falha ao
 * carregar, cai no placeholder com as iniciais — nunca derruba a página.
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
  const [failed, setFailed] = useState(false);

  if (!failed && isPublicStorageUrl(src)) {
    return (
      <span
        className={cn("relative block shrink-0 overflow-hidden rounded-md", className)}
        style={{ height: size, width: size }}
      >
        <Image
          src={src}
          alt={text}
          fill
          sizes={`${size}px`}
          className="object-contain"
          onError={() => setFailed(true)}
        />
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

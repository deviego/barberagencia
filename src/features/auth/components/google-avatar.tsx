"use client";

import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";

/**
 * Foto do Google na confirmação do WhatsApp. A CSP libera só lh3.googleusercontent.com;
 * se a foto vier de outro host (ou falhar ao carregar), cai na marca da barbearia.
 */
export function GoogleAvatar({
  src,
  logoText,
  logoUrl,
  size = 72,
}: {
  src: string | null;
  logoText: string;
  logoUrl: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <LogoMark text={logoText} src={logoUrl} size={size} className="rounded-lg shadow-lg" />;
  }

  return (
    // Domínio externo: <img> simples, sem otimização do Next.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      // Falha antes da hidratação não dispara onError: confere ao montar.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setFailed(true);
      }}
      className="rounded-full border-2 border-accent object-cover"
      style={{ width: size, height: size }}
    />
  );
}

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Copyright } from "@/components/brand/copyright";
import { brandingStyle } from "@/lib/tenant/branding-style";
import type { QuickQueueBrand } from "../types";

/**
 * Moldura da fila rápida (/b/<slug>/fila/rapida), mobile-first.
 * As cores da barbearia são aplicadas aqui, e não só no <html>: o layout raiz usa o tenant
 * da sessão, que pode ser de outra barbearia. Sem `brand` (qualquer estado fora de OPEN) a tela
 * fica neutra e não mostra dado nenhum da barbearia.
 */
export function QuickQueueShell({
  brand,
  children,
}: {
  brand?: QuickQueueBrand | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-x-hidden bg-canvas"
      style={brand ? brandingStyle(brand) : undefined}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5 opacity-85"
        style={{
          background:
            "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 12px, var(--bb-pole-white) 12px 24px, var(--bb-pole-blue) 24px 36px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 0%, var(--bb-accent-wash), transparent)" }}
      />

      {brand && (
        <header className="relative flex flex-col items-center gap-3 px-4 pt-10 text-center">
          <LogoMark text={brand.logoText} src={brand.logoUrl} size={64} className="rounded-xl" />
          <p className="max-w-full break-words font-display text-h5 font-extrabold tracking-wide text-text">{brand.name}</p>
        </header>
      )}

      <main className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col px-4 pb-6 pt-8">
        {children}
      </main>

      <footer className="relative flex flex-col items-center gap-2 px-4 pb-6">
        {brand ? (
          // Copy aprovada pela Regua no #126 (LGPD). Sem o nome carregado: "desta barbearia".
          <p className="max-w-[380px] text-center text-caption text-text-2">
            Seu nome e telefone ficam no cadastro{" "}
            {brand.name?.trim() ? (
              <>
                da <span className="font-semibold text-text">{brand.name.trim()}</span>
              </>
            ) : (
              "desta barbearia"
            )}
            , para a sua senha na fila e para falar com você sobre o atendimento.{" "}
            <Link
              href="/privacidade"
              className="-my-3 inline-block py-3 underline underline-offset-4 hover:text-accent"
            >
              Aviso de privacidade
            </Link>
          </p>
        ) : (
          <Link
            href="/privacidade"
            className="inline-flex min-h-11 items-center px-2 text-caption text-text-2 underline underline-offset-4 hover:text-accent"
          >
            Aviso de privacidade
          </Link>
        )}
        <Copyright />
      </footer>
    </div>
  );
}

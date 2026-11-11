import Link from "next/link";
import { FOOTER_COLS } from "@/features/landing/content";

/** Rodapé da landing. `anchorBase="/"` fora da home, para "#planos" virar "/#planos". */
export function LandingFooter({ anchorBase = "" }: { anchorBase?: string }) {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-12 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-[16px] font-black text-text-inverse">
              B✦
            </span>
            <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.04em]">Barber Agência</span>
          </div>
          <p className="m-0 max-w-[280px] text-[13px] leading-[1.55] text-text-muted">
            Plataforma white-label para barbearias: agenda online, fila por QR code, mensalidade com saldo de cortes e
            financeiro, com a marca da sua barbearia.
          </p>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{col.title}</span>
            {col.links.map((l) =>
              l.href.startsWith("#") ? (
                <a
                  key={l.label}
                  href={`${anchorBase}${l.href}`}
                  className="text-[13px] text-text-2 transition-colors hover:text-accent"
                >
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} className="text-[13px] text-text-2 transition-colors hover:text-accent">
                  {l.label}
                </Link>
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center border-t border-border-subtle px-6 py-5 text-center text-[12px] text-text-muted sm:px-10">
        © 2026 Barber Agência · Todos os direitos reservados
      </div>
    </footer>
  );
}

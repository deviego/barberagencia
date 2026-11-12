"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DISTRIBUTOR_NAV_LINK, NAV_LINKS, salesWaLink, WA_MESSAGES } from "@/features/landing/content";

type Props = {
  /** Prefixo das âncoras da home ("/" fora da home, para "#planos" virar "/#planos"). */
  anchorBase?: string;
  /** Mensagem do botão principal (WhatsApp comercial). */
  ctaMessage?: string;
};

export function LandingHeader({ anchorBase = "", ctaMessage = WA_MESSAGES.start }: Props = {}) {
  const [open, setOpen] = useState(false);
  const links = [
    ...NAV_LINKS.map((l) => ({ ...l, href: l.href.startsWith("#") ? `${anchorBase}${l.href}` : l.href })),
    DISTRIBUTOR_NAV_LINK,
  ];

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: "var(--bb-header-bg)", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex max-w-[1240px] flex-nowrap items-center justify-between gap-5 px-5 py-3.5 sm:px-8">
        {/* Marca */}
        <a href={`${anchorBase}#produto`} className="flex shrink-0 items-center gap-3">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-accent font-display text-[17px] font-black text-text-inverse">
            B✦
          </span>
          <span className="whitespace-nowrap font-display text-[19px] font-extrabold uppercase tracking-[0.04em] text-text">
            Barber Agência
          </span>
        </a>

        {/* Nav central (some abaixo de 1180px) */}
        <nav className="hidden gap-0.5 text-[14px] min-[1181px]:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-md px-3.5 py-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Ações (nunca cortadas) */}
        <div className="flex shrink-0 items-center gap-2.5">
          <ThemeToggle />
          <a
            href={salesWaLink(ctaMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden whitespace-nowrap rounded-md bg-accent px-[18px] py-2 text-[14px] font-bold text-text-inverse transition-colors hover:bg-accent-hover min-[1181px]:inline-flex"
          >
            Começar agora
          </a>
          {/* Hambúrguer (abaixo de 1180px) */}
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-2 transition-colors hover:border-accent hover:text-accent min-[1181px]:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-border bg-surface px-5 py-3 min-[1181px]:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-[15px] text-text-2 transition-colors hover:bg-accent-wash hover:text-accent"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <a
                href={salesWaLink(ctaMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-accent px-3 py-2.5 text-center text-[15px] font-bold text-text-inverse"
              >
                Começar agora
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

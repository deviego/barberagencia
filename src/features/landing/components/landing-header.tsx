"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NAV_LINKS, salesWaLink, WA_MESSAGES } from "@/features/landing/content";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: "rgba(13,13,13,0.82)", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex max-w-[1240px] flex-nowrap items-center justify-between gap-5 px-5 py-3.5 sm:px-8">
        {/* Marca */}
        <a href="#produto" className="flex shrink-0 items-center" aria-label="Barber Agência">
          <div className="relative h-10 w-36 overflow-hidden rounded">
            <Image src="/barber-agencia-logo.jpeg" alt="Barber Agência" fill sizes="144px" className="object-cover object-center" priority />
          </div>
        </a>

        {/* Nav central (some abaixo de 1080px) */}
        <nav className="hidden gap-0.5 text-[14px] min-[1081px]:flex">
          {NAV_LINKS.map((l) => (
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
          <Link
            href="/admin/login"
            className="hidden whitespace-nowrap rounded-md border border-border px-4 py-2 text-[14px] font-medium text-text transition-colors hover:border-accent hover:text-accent sm:inline-flex"
          >
            Entrar
          </Link>
          <a
            href={salesWaLink(WA_MESSAGES.trial)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden whitespace-nowrap rounded-md bg-accent px-[18px] py-2 text-[14px] font-bold text-text-inverse transition-colors hover:bg-accent-hover min-[1081px]:inline-flex"
          >
            Teste 15 dias grátis
          </a>
          {/* Hambúrguer (abaixo de 1080px) */}
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-2 transition-colors hover:border-accent hover:text-accent min-[1081px]:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-border bg-surface px-5 py-3 min-[1081px]:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
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
              <Link
                href="/admin/login"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-3 py-2.5 text-center text-[15px] font-medium text-text"
              >
                Entrar
              </Link>
              <a
                href={salesWaLink(WA_MESSAGES.trial)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-accent px-3 py-2.5 text-center text-[15px] font-bold text-text-inverse"
              >
                Teste 15 dias grátis
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

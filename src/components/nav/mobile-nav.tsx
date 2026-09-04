"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

export interface MobileNavItem {
  href: string;
  label: string;
  icon: IconType;
  badge?: number;
}

/**
 * Menu de navegação em TELA CHEIA no mobile (admin/master). Some no desktop (md+).
 * Desliza da esquerda, trava o scroll do fundo e fecha ao navegar.
 */
export function MobileNav({
  open,
  onClose,
  items,
  pathname,
  rootHref,
  title = "Menu",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  pathname: string;
  rootHref: string;
  title?: string;
  footer?: React.ReactNode;
}) {
  // Trava o scroll do fundo enquanto o menu está aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 top-14 z-drawer transition-opacity duration-200 md:hidden",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex h-full w-full flex-col bg-surface shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="truncate text-body-lg font-bold uppercase tracking-wide text-text">{title}</span>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-accent-wash hover:text-accent"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map(({ href, label, icon: Icon, badge }) => {
            const active = href === rootHref ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3.5 rounded-lg px-4 py-3.5 text-body-lg transition-colors",
                  active ? "bg-accent-wash font-bold text-accent" : "text-text-2 hover:bg-accent-wash hover:text-accent"
                )}
              >
                <Icon size={22} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badge ? <Badge variant="danger">{badge}</Badge> : null}
              </Link>
            );
          })}
        </nav>

        {footer && <div className="flex flex-col gap-1.5 border-t border-border p-3">{footer}</div>}
      </aside>
    </div>
  );
}

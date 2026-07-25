"use client";

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

/** Menu lateral deslizante para navegação no mobile (admin/master). Some no desktop. */
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-drawer flex md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <aside
        className="relative flex h-full w-64 max-w-[82%] flex-col gap-0.5 border-r border-border bg-surface p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="truncate text-caption font-semibold uppercase text-text-muted">{title}</span>
          <button onClick={onClose} aria-label="Fechar menu" className="p-1 text-text-muted transition-colors hover:text-accent">
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {items.map(({ href, label, icon: Icon, badge }) => {
            const active = href === rootHref ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-body transition-colors",
                  active ? "bg-accent-wash font-bold text-accent" : "text-text-2 hover:bg-accent-wash hover:text-accent"
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badge ? <Badge variant="danger">{badge}</Badge> : null}
              </Link>
            );
          })}
        </nav>

        {footer && <div className="mt-2 border-t border-border pt-2">{footer}</div>}
      </aside>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CLIENT_NAV } from "@/features/client/nav";
import { cn } from "@/lib/utils";

/** Navegação inferior (mobile) do app do cliente. */
export function BottomNav({
  agendarHref = "/servicos",
  hasPlan = true,
}: {
  agendarHref?: string;
  hasPlan?: boolean;
}) {
  const pathname = usePathname();
  const navItems = CLIENT_NAV.filter((i) => hasPlan || i.href !== "/meu-plano");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-sticky flex items-center justify-around border-t border-border bg-surface px-2 py-1.5 md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const target = href === "/servicos" ? agendarHref : href;
        const active = pathname === target;
        return (
          <Link
            key={href}
            href={target}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors",
              active ? "text-accent" : "text-text-muted hover:text-text-2"
            )}
          >
            <Icon size={20} className="shrink-0" />
            <span className="w-full truncate text-center text-[10px] leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

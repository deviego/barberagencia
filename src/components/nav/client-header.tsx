"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CLIENT_NAV } from "@/features/client/nav";
import { cn } from "@/lib/utils";

export function ClientHeader({
  logoText,
  logoUrl,
  name,
}: {
  logoText: string;
  logoUrl?: string | null;
  name: string;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-5 py-3 md:px-8">
      <Link href="/" className="flex items-center gap-3 text-text">
        <LogoMark text={logoText} src={logoUrl} />
        <span className="font-display text-h5 font-extrabold uppercase tracking-wide">{name}</span>
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        {CLIENT_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-body transition-colors",
                active ? "bg-accent-wash text-accent" : "text-text-2 hover:text-text"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          className="relative flex rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent"
          aria-label="Notificações"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-surface bg-danger" />
        </button>
        <ThemeToggle />
        <Link
          href="/perfil"
          aria-label="Perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-caption font-bold text-text-inverse"
        >
          W
        </Link>
      </div>
    </header>
  );
}

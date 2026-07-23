"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoutButton } from "@/components/nav/logout-button";
import { CLIENT_NAV } from "@/features/client/nav";
import { cn, getInitials } from "@/lib/utils";

export function ClientHeader({
  logoText,
  logoUrl,
  name,
  userName,
  userEmail,
  avatarUrl,
  agendarHref = "/servicos",
  hasPlan = true,
}: {
  logoText: string;
  logoUrl?: string | null;
  name: string;
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  agendarHref?: string;
  hasPlan?: boolean;
}) {
  const pathname = usePathname();
  const initials = getInitials(userName, userEmail);
  const navItems = CLIENT_NAV.filter((i) => hasPlan || i.href !== "/meu-plano");
  return (
    <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-5 py-3 md:px-8">
      <Link href="/" className="flex items-center gap-3 text-text">
        <LogoMark text={logoText} src={logoUrl} />
        <span className="font-display text-h5 font-extrabold uppercase tracking-wide">{name}</span>
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const target = href === "/servicos" ? agendarHref : href;
          const active = pathname === target;
          return (
            <Link
              key={href}
              href={target}
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
        <ThemeToggle />
        <Link href="/perfil" aria-label="Perfil" className="flex">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={initials} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-caption font-bold text-text-inverse">
              {initials}
            </span>
          )}
        </Link>
        <LogoutButton className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}

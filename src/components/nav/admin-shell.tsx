"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FabWhatsApp } from "@/components/nav/fab-whatsapp";
import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { ADMIN_NAV } from "@/features/admin/nav";
import { hasEntitlement } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { cn } from "@/lib/utils";

export function AdminShell({
  logoText,
  logoUrl,
  name,
  plan,
  children,
}: {
  logoText: string;
  logoUrl?: string | null;
  name: string;
  plan: SaasPlanKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const items = ADMIN_NAV.filter((i) => !i.feature || hasEntitlement(plan, i.feature));
  const shortName = name.replace(/^Barbearia\s+/i, "");
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar full-width */}
      <header className="sticky top-0 z-drawer flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Alternar menu"
            className="flex rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent"
          >
            <Menu size={18} />
          </button>
          <Link href="/admin" className="flex items-center gap-2.5 text-text">
            <LogoMark text={logoText} src={logoUrl} size={30} />
            <span className="hidden font-display text-h5 font-extrabold uppercase tracking-wide sm:inline">
              {name}
            </span>
          </Link>
        </div>

        <div className="hidden max-w-[340px] flex-1 items-center gap-2 rounded-md border border-border bg-inset px-3 py-2 md:flex">
          <Search size={15} className="text-text-muted" />
          <input
            placeholder="Buscar cliente, serviço, agendamento…"
            className="w-full bg-transparent text-caption text-text placeholder:text-text-muted focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-caption text-text transition-colors hover:border-accent sm:flex">
            <Building2 size={15} className="text-accent" />
            {shortName}
            <ChevronDown size={14} className="text-text-muted" />
          </button>
          <span className="relative flex cursor-pointer rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent">
            <Bell size={18} />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-surface bg-danger" />
          </span>
          <ThemeToggle />
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold text-white"
            style={{ background: "var(--bb-pole-blue)" }}
          >
            {initials}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col gap-0.5 border-r border-border bg-surface p-2.5 transition-all md:flex",
            open ? "w-56" : "w-16"
          )}
        >
          {items.map(({ href, label, icon: Icon, badge }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-body transition-colors",
                  open ? "justify-start" : "justify-center",
                  active
                    ? "bg-accent-wash font-bold text-accent"
                    : "text-text-2 hover:bg-accent-wash hover:text-accent"
                )}
              >
                <Icon size={18} className="shrink-0" />
                {open && <span className="flex-1 truncate">{label}</span>}
                {open && badge ? <Badge variant="danger">{badge}</Badge> : null}
              </Link>
            );
          })}
          <Link
            href="/"
            className={cn(
              "mt-auto flex items-center gap-3 rounded-md px-3 py-2.5 text-caption text-text-muted transition-colors hover:text-accent",
              open ? "justify-start" : "justify-center"
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {open && "Ver como cliente"}
          </Link>
        </aside>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
      <FabWhatsApp href="https://wa.me/5521990883359" />
    </div>
  );
}

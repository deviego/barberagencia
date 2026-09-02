"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DISTRIBUTOR_NAV } from "@/features/distributor/nav";
import { LogoutButton } from "@/components/nav/logout-button";
import { cn } from "@/lib/utils";

export function DistributorSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-text font-display text-h5 font-black text-text-inverse">
          B✦
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-h6 font-extrabold uppercase tracking-wide text-text">{name}</div>
          <div className="text-caption text-text-muted">Distribuidor</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {DISTRIBUTOR_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/distributor" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
                active ? "bg-accent font-bold text-text-inverse" : "text-text-2 hover:bg-accent-wash hover:text-accent"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <LogoutButton variant="sidebar" />
      </div>
    </aside>
  );
}

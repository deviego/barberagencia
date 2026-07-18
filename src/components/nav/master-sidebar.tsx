"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MASTER_NAV } from "@/features/platform/nav";
import { cn } from "@/lib/utils";

export function MasterSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-text font-display text-h5 font-black text-text-inverse">
          B✦
        </div>
        <div>
          <div className="font-display text-h6 font-extrabold uppercase tracking-wide text-text">
            Barber Platform
          </div>
          <div className="text-caption text-text-muted">Admin Master · SaaS</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {MASTER_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/master" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
                active
                  ? "bg-accent font-bold text-text-inverse"
                  : "text-text-2 hover:bg-accent-wash hover:text-accent"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

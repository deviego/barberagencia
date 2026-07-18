"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ADMIN_NAV } from "@/features/admin/nav";
import { hasEntitlement } from "@/lib/entitlements";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AdminSidebar({
  logoText,
  name,
  plan,
}: {
  logoText: string;
  name: string;
  plan: SaasPlanKey;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = ADMIN_NAV.filter((i) => !i.feature || hasEntitlement(plan, i.feature));

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-all md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <LogoMark text={logoText} />
        {!collapsed && (
          <span className="truncate font-display text-h6 font-extrabold uppercase tracking-wide">
            {name}
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
                active ? "bg-accent-wash text-accent" : "text-text-2 hover:bg-inset hover:text-text"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && badge ? <Badge variant="danger">{badge}</Badge> : null}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-3 border-t border-border px-4 py-3 text-caption text-text-muted transition-colors hover:text-accent"
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed && "Recolher"}
      </button>
    </aside>
  );
}

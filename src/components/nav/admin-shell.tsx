"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, ChevronDown, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoutButton } from "@/components/nav/logout-button";
import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { ADMIN_NAV } from "@/features/admin/nav";
import { hasEntitlement } from "@/lib/entitlements";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { cn, getInitials } from "@/lib/utils";

/** Bip curto (Web Audio) — só toca após 1ª interação do usuário na página. */
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    /* autoplay bloqueado — ignora */
  }
}

export function AdminShell({
  logoText,
  logoUrl,
  name,
  plan,
  userName,
  userEmail,
  avatarUrl,
  pendingCount = 0,
  children,
}: {
  logoText: string;
  logoUrl?: string | null;
  name: string;
  plan: SaasPlanKey;
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  pendingCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [count, setCount] = useState(pendingCount);
  const prevCount = useRef(pendingCount);

  const items = ADMIN_NAV.filter((i) => !i.feature || hasEntitlement(plan, i.feature));
  const shortName = name.replace(/^Barbearia\s+/i, "");
  const initials = getInitials(userName, userEmail);

  // Realtime: atualiza o contador de solicitações e toca som ao chegar algo novo.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function refresh() {
      const [appts, plans, reservas] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
        supabase.from("plan_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("product_reservations").select("id", { count: "exact", head: true }).eq("status", "RESERVED"),
      ]);
      const next = (appts.count ?? 0) + (plans.count ?? 0) + (reservas.count ?? 0);
      if (next > prevCount.current) playBeep();
      prevCount.current = next;
      setCount(next);
    }
    const channel = supabase
      .channel("admin-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_reservations" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
          <Link
            href="/admin/solicitacoes"
            aria-label="Solicitações"
            className="relative flex rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent"
          >
            <Bell size={18} />
            {count > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-surface bg-danger" />
            )}
          </Link>
          <ThemeToggle />
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={initials} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold text-white"
              style={{ background: "var(--bb-pole-blue)" }}
            >
              {initials}
            </span>
          )}
          <LogoutButton />
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
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            const badge = href === "/admin/solicitacoes" && count > 0 ? count : undefined;
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
          <div className="mt-auto">
            <LogoutButton variant="sidebar" className={open ? "justify-start" : "justify-center"} />
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}

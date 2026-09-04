"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, Menu, Search, Shield, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoutButton } from "@/components/nav/logout-button";
import { BarbershopSwitcher } from "@/components/nav/barbershop-switcher";
import { ViewAsClientButton } from "@/components/nav/view-as-client-button";
import { MobileNav } from "@/components/nav/mobile-nav";
import { TrialBanner } from "@/components/nav/trial-banner";
import { Copyright } from "@/components/brand/copyright";
import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { ADMIN_NAV } from "@/features/admin/nav";
import { hasEntitlement } from "@/lib/entitlements";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SaasPlanKey } from "@/lib/tenant/types";
import { cn } from "@/lib/utils";

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
  pendingCount = 0,
  trialEndsAt,
  isMaster = false,
  tenants,
  acting = false,
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
  trialEndsAt?: string | null;
  isMaster?: boolean;
  tenants?: { id: string; name: string }[];
  acting?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [count, setCount] = useState(pendingCount);
  const prevCount = useRef(pendingCount);

  const items = ADMIN_NAV.filter((i) => !i.feature || hasEntitlement(plan, i.feature));
  const mobileItems = items.map((i) => ({
    href: i.href,
    label: i.label,
    icon: i.icon,
    badge: i.href === "/admin/solicitacoes" && count > 0 ? count : undefined,
  }));

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
      // Re-busca os server components (lista de solicitações etc.) sem F5.
      router.refresh();
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
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      {trialEndsAt && <TrialBanner endsAt={trialEndsAt} />}
      <MobileNav
        open={mobileNav}
        onClose={() => setMobileNav(false)}
        items={mobileItems}
        pathname={pathname}
        rootHref="/admin"
        title={name}
        footer={
          <>
            {isMaster && (
              <Link
                href="/master"
                onClick={() => setMobileNav(false)}
                className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-body font-semibold text-text-2 transition-colors hover:border-accent hover:text-accent"
              >
                <Shield size={18} /> Painel Master
              </Link>
            )}
            <a
              href="/documentacao"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-md border border-accent bg-accent-wash px-3 py-2.5 text-body font-semibold text-accent transition-colors hover:brightness-95"
            >
              <BookOpen size={18} /> Documentação
            </a>
            <ViewAsClientButton />
            <LogoutButton variant="sidebar" />
          </>
        }
      />

      {/* Topbar full-width */}
      <header className="sticky top-0 z-drawer flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-2.5">
        <div className="flex items-center gap-3">
          {/* Mobile: abre/fecha o menu (o botão vira X quando aberto). */}
          <button
            onClick={() => setMobileNav((m) => !m)}
            aria-label={mobileNav ? "Fechar menu" : "Abrir menu"}
            className="flex rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent md:hidden"
          >
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
          {/* Desktop: colapsa/expande a sidebar. */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Alternar menu"
            className="hidden rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent md:flex"
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
          {isMaster && tenants ? (
            <BarbershopSwitcher tenants={tenants} currentName={name} acting={acting} />
          ) : null}
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
          <div className="mt-auto flex flex-col gap-1.5">
            {isMaster && (
              <Link
                href="/master"
                title="Painel Master"
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-body font-semibold text-text-2 transition-colors hover:border-accent hover:text-accent",
                  open ? "justify-start" : "justify-center"
                )}
              >
                <Shield size={18} className="shrink-0" />
                {open && <span>Painel Master</span>}
              </Link>
            )}
            <a
              href="/documentacao"
              target="_blank"
              rel="noopener noreferrer"
              title="Documentação"
              className={cn(
                "flex items-center gap-3 rounded-md border border-accent bg-accent-wash px-3 py-2.5 text-body font-semibold text-accent transition-colors hover:brightness-95",
                open ? "justify-start" : "justify-center"
              )}
            >
              <BookOpen size={18} className="shrink-0" />
              {open && <span>Documentação</span>}
            </a>
            {open && <ViewAsClientButton />}
            <LogoutButton variant="sidebar" className={open ? "justify-start" : "justify-center"} />
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-x-hidden">
          <div className="flex-1 p-4 md:p-6">{children}</div>
          <Copyright className="border-t border-border py-3" />
        </main>
      </div>
    </div>
  );
}

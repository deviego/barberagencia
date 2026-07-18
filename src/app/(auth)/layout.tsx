import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-8 py-3">
        <Link href="/login" className="flex items-center gap-3 text-text">
          <LogoMark text={tenant.branding.logoText} />
          <div>
            <div className="font-display text-h5 font-extrabold uppercase tracking-wide">
              {tenant.name}
            </div>
            <div className="text-caption text-text-muted">Acesso à sua conta</div>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      {/* Palco central com faixa barber-pole + gradiente dourado */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
        <div
          className="absolute inset-x-0 top-0 h-1.5 opacity-85"
          style={{
            background:
              "repeating-linear-gradient(-45deg, var(--bb-pole-red) 0 12px, var(--bb-pole-white) 12px 24px, var(--bb-pole-blue) 24px 36px)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 0%, var(--bb-accent-wash), transparent)",
          }}
        />
        <div className="relative w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}

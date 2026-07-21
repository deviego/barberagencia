import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** Casca visual das telas de login (topbar + faixa barber-pole + centro). */
export function AuthScreen({
  logoText,
  logoUrl,
  name,
  subtitle,
  children,
}: {
  logoText: string;
  logoUrl?: string | null;
  name: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-8 py-3">
        <div className="flex items-center gap-3 text-text">
          <LogoMark text={logoText} src={logoUrl} />
          <div>
            <div className="font-display text-h5 font-extrabold uppercase tracking-wide">{name}</div>
            {subtitle && <div className="text-caption text-text-muted">{subtitle}</div>}
          </div>
        </div>
        <ThemeToggle />
      </header>

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
        <div className="relative w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}

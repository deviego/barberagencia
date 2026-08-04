import Image from "next/image";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Copyright } from "@/components/brand/copyright";

/**
 * Casca visual das telas de login. Marca FIXA "barberagencia" — a identidade
 * da barbearia só aparece após o login. (Props de tenant são aceitas por
 * compatibilidade, mas não são exibidas aqui.)
 */
export function AuthScreen({
  subtitle,
  children,
}: {
  logoText?: string;
  logoUrl?: string | null;
  name?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-8 py-3">
        <div className="flex items-center gap-3 text-text">
          <div className="relative h-9 w-32 overflow-hidden rounded">
            <Image src="/barber-agencia-logo.jpeg" alt="Barber Agência" fill sizes="128px" className="object-cover object-center" priority />
          </div>
          {subtitle && <span className="text-caption text-text-muted">{subtitle}</span>}
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
        <Copyright className="absolute inset-x-0 bottom-4" />
      </main>
    </div>
  );
}

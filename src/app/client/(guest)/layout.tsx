import Link from "next/link";
import Image from "next/image";
import { Scissors } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Copyright } from "@/components/brand/copyright";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar — marca fixa "barberagencia" (a barbearia aparece só após logar) */}
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-8 py-3">
        <Link href="/client/login" className="flex items-center gap-3 text-text">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-text-inverse">
            <Scissors size={18} />
          </span>
          <div>
            <div className="font-display text-h5 font-extrabold tracking-wide">Barber Agência</div>
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
        <div className="relative flex w-full max-w-[440px] flex-col items-center gap-7">
          <div className="relative h-28 w-56 overflow-hidden rounded-lg">
            <Image src="/barber-agencia-logo.jpeg" alt="Barber Agência" fill sizes="224px" className="object-cover object-center" priority />
          </div>
          <div className="w-full">{children}</div>
        </div>
        <Copyright className="absolute inset-x-0 bottom-4" />
      </main>
    </div>
  );
}

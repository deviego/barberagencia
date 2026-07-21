import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-5 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3 text-text">
          <LogoMark text={tenant.branding.logoText} src={tenant.branding.logoUrl} />
          <span className="font-display text-h5 font-extrabold uppercase tracking-wide">
            {tenant.name}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent"
          >
            <ArrowLeft size={15} />
            Voltar
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="px-5 py-10 md:px-8">{children}</main>
    </div>
  );
}

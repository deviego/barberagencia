import { MasterSidebar } from "@/components/nav/master-sidebar";
import { MasterMobileMenu } from "@/components/nav/master-mobile-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  // TEMP: rota master pública por enquanto (guard de papel MASTER desativado).
  // Reativar depois: exigir getSessionUser() + isMaster(user.role).
  return (
    <div className="flex min-h-screen">
      <MasterSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MasterMobileMenu />
            <span className="truncate text-body font-semibold text-text">Plataforma White-Label</span>
            <Badge variant="accent">Master</Badge>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

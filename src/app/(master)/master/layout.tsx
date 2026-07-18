import { MasterSidebar } from "@/components/nav/master-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <MasterSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-body font-semibold text-text">Plataforma White-Label</span>
            <Badge variant="accent">Master</Badge>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

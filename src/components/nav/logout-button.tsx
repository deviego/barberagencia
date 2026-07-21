import { LogOut } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

/** Botão "Sair" via server action (form) — funciona em qualquer shell. */
export function LogoutButton({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "sidebar";
  className?: string;
}) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={cn(
          variant === "sidebar"
            ? "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-caption text-text-muted transition-colors hover:text-accent"
            : "inline-flex h-9 items-center gap-2 rounded-md px-3 text-body text-text-2 transition-colors hover:bg-accent-wash hover:text-accent",
          className
        )}
      >
        <LogOut size={variant === "sidebar" ? 18 : 16} />
        Sair
      </button>
    </form>
  );
}

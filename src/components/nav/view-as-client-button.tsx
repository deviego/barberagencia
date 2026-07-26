import { Eye } from "lucide-react";
import { enterClientPreview } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

/** Botão "Ver como cliente" (server action) — admin visualiza o app do cliente. */
export function ViewAsClientButton({ className }: { className?: string }) {
  return (
    <form action={enterClientPreview}>
      <button
        type="submit"
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-caption text-text-muted transition-colors hover:text-accent",
          className
        )}
      >
        <Eye size={18} />
        Ver como cliente
      </button>
    </form>
  );
}

import Link from "next/link";
import { Megaphone, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "mensagens", label: "Mensagens", icon: MessageSquareText },
] as const;

/** Barra de abas do Marketing Place (troca via ?tab=). */
export function MarketingPlaceTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <Link
            key={t.key}
            href={`/admin/marketing-place?tab=${t.key}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-body transition-colors",
              on ? "bg-accent-wash font-bold text-accent" : "text-text-2 hover:text-accent"
            )}
          >
            <t.icon size={16} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

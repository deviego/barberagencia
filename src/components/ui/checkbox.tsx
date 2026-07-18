"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors",
        checked ? "border-accent bg-accent text-text-inverse" : "border-border bg-inset",
        className
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

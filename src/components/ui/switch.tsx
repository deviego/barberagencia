"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  defaultChecked = false,
  onChange,
  disabled = false,
  ...aria
}: {
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      {...aria}
      onClick={() => {
        const v = !on;
        setOn(v);
        onChange?.(v);
      }}
      className={cn(
        "relative h-6 w-11 flex-shrink-0 rounded-pill border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        on ? "border-accent bg-accent" : "border-border bg-inset"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-all",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}

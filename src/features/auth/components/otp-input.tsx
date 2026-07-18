"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const LEN = 6;

export function OtpInput({ onComplete }: { onComplete?: (code: string) => void }) {
  const [values, setValues] = useState<string[]>(Array(LEN).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setAt(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[i] = digit;
    setValues(next);
    if (digit && i < LEN - 1) refs.current[i + 1]?.focus();
    const code = next.join("");
    if (code.length === LEN && !next.includes("")) onComplete?.(code);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !values[i] && i > 0) refs.current[i - 1]?.focus();
  }

  return (
    <div className="flex justify-center gap-2.5">
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={v}
          inputMode="numeric"
          maxLength={1}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className={cn(
            "h-14 w-[46px] rounded-md border bg-inset text-center text-2xl font-bold text-text transition-colors focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus",
            v ? "border-accent" : "border-border"
          )}
        />
      ))}
    </div>
  );
}

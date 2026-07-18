"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex">
      <input
        type={show ? "text" : "password"}
        placeholder="••••••••"
        className={cn(
          "h-11 w-full rounded-md border border-border bg-inset px-3 pr-11 text-body text-text placeholder:text-text-muted transition-colors focus-visible:border-focus focus-visible:outline-none",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center p-1.5 text-text-muted transition-colors hover:text-accent"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

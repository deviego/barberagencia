import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border bg-inset px-3 text-body text-text placeholder:text-text-muted transition-colors",
        "focus-visible:outline-none focus-visible:border-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-danger" : "border-border hover:border-accent",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-caption font-semibold text-text-2", className)}
      {...props}
    />
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-overline font-semibold uppercase",
  {
    variants: {
      variant: {
        neutral: "bg-inset text-text-2",
        accent: "bg-accent-wash text-accent",
        success: "bg-success-bg text-success-strong",
        warning: "bg-warning-bg text-warning-strong",
        danger: "bg-danger-bg text-danger-strong",
        info: "bg-info-bg text-info",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

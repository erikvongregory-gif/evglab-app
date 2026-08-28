import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiBadgeTone = "neutral" | "accent" | "success" | "warning" | "error" | "info";

export type StudioUiBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: StudioUiBadgeTone;
};

export function StudioUiBadge({
  className,
  tone = "neutral",
  children,
  ...props
}: StudioUiBadgeProps) {
  return (
    <span className={cn("stu-badge", `stu-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

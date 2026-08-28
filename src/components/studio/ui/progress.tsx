import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiProgressTone = "accent" | "ok" | "warn" | "err";

export type StudioUiProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  /** 0–100; ignoriert bei indeterminate */
  value?: number;
  tone?: StudioUiProgressTone;
  indeterminate?: boolean;
  label?: string;
};

export function StudioUiProgress({
  className,
  value = 0,
  tone = "accent",
  indeterminate = false,
  label,
  ...props
}: StudioUiProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "stu-progress",
        tone !== "accent" && `stu-progress--${tone}`,
        indeterminate && "stu-progress--indeterminate",
        className,
      )}
      role="progressbar"
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-label={label}
      {...props}
    >
      <div className="stu-progress__bar" style={indeterminate ? undefined : { width: `${clamped}%` }} />
    </div>
  );
}

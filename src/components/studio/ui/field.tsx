import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiLabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export function StudioUiLabel({ className, required, children, ...props }: StudioUiLabelProps) {
  return (
    <label className={cn("stu-label", className)} {...props}>
      {children}
      {required ? (
        <span className="stu-label__req" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export type StudioUiHintTone = "hint" | "error" | "success" | "warning";

export type StudioUiHintProps = React.HTMLAttributes<HTMLParagraphElement> & {
  tone?: StudioUiHintTone;
};

export function StudioUiHint({ className, tone = "hint", children, id, ...props }: StudioUiHintProps) {
  const role = tone === "error" ? "alert" : undefined;
  return (
    <p
      id={id}
      role={role}
      className={cn(
        "stu-hint",
        tone === "error" && "stu-hint--error",
        tone === "success" && "stu-hint--success",
        tone === "warning" && "stu-hint--warning",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

/** Gruppiert Label + Control + Hint mit korrektem Spacing. */
export function StudioUiField({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("stu-field", className)} {...props}>
      {children}
    </div>
  );
}

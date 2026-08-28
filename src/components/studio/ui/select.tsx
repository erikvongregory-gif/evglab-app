"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
  success?: boolean;
};

/** Native Select-Trigger (FINAL-Styling). Dropdown-Menü = Browser-Native. */
export const StudioUiSelect = React.forwardRef<HTMLSelectElement, StudioUiSelectProps>(
  ({ className, error, success, disabled, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "stu-select",
          error && "stu-select--error",
          success && !error && "stu-select--success",
          className,
        )}
        disabled={disabled}
        aria-invalid={error || undefined}
        {...props}
      >
        {children}
      </select>
    );
  },
);
StudioUiSelect.displayName = "StudioUiSelect";

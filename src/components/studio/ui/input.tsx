"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  error?: boolean;
  success?: boolean;
};

export const StudioUiInput = React.forwardRef<HTMLInputElement, StudioUiInputProps>(
  ({ className, error, success, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "stu-input",
          error && "stu-input--error",
          success && !error && "stu-input--success",
          className,
        )}
        disabled={disabled}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  },
);
StudioUiInput.displayName = "StudioUiInput";

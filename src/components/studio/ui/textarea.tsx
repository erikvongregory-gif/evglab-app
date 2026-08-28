"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
  success?: boolean;
};

export const StudioUiTextarea = React.forwardRef<HTMLTextAreaElement, StudioUiTextareaProps>(
  ({ className, error, success, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "stu-textarea",
          error && "stu-textarea--error",
          success && !error && "stu-textarea--success",
          className,
        )}
        disabled={disabled}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  },
);
StudioUiTextarea.displayName = "StudioUiTextarea";

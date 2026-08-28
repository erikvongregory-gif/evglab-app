"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type StudioUiButtonSize = "sm" | "md" | "lg";

export type StudioUiButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StudioUiButtonVariant;
  size?: StudioUiButtonSize;
  loading?: boolean;
};

export const StudioUiButton = React.forwardRef<HTMLButtonElement, StudioUiButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled || loading);
    return (
      <button
        ref={ref}
        type={type}
        className={cn("stu-btn", `stu-btn--${variant}`, `stu-btn--${size}`, className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        {...props}
      >
        {loading ? <span className="stu-btn__spinner" aria-hidden="true" /> : null}
        {children}
      </button>
    );
  },
);
StudioUiButton.displayName = "StudioUiButton";

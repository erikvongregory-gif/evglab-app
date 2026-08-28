"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiIconButtonVariant = "ghost" | "secondary" | "danger";
export type StudioUiIconButtonSize = "sm" | "md" | "lg";

export type StudioUiIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StudioUiIconButtonVariant;
  size?: StudioUiIconButtonSize;
  loading?: boolean;
  /** Erforderlich für reine Icon-Buttons ohne sichtbaren Text. */
  "aria-label": string;
};

export const StudioUiIconButton = React.forwardRef<HTMLButtonElement, StudioUiIconButtonProps>(
  (
    {
      className,
      variant = "ghost",
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
        className={cn(
          "stu-icon-btn",
          variant !== "ghost" && `stu-icon-btn--${variant}`,
          size !== "md" && `stu-icon-btn--${size}`,
          className,
        )}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        {...props}
      >
        {loading ? <span className="stu-btn__spinner" aria-hidden="true" /> : children}
      </button>
    );
  },
);
StudioUiIconButton.displayName = "StudioUiIconButton";

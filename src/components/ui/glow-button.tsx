"use client";

import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { StudioIcon } from "@/components/studio/icons";
import { cn } from "@/lib/utils";

export interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: ReactNode;
  showIcon?: boolean;
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    {
      label = "Generieren",
      onClick,
      className,
      disabled,
      showIcon = true,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      setIsClicked(true);
      window.setTimeout(() => setIsClicked(false), 200);
      onClick?.(event);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-label={typeof label === "string" ? label : "Generieren"}
        className={cn("glow-btn", isClicked && "glow-btn--pressed", className)}
        onClick={handleClick}
        data-state={isClicked ? "clicked" : undefined}
        {...props}
      >
        <span className="glow-btn__label">
          {children ?? label}
          {showIcon ? <StudioIcon name="spark" size={15} /> : null}
        </span>
      </button>
    );
  },
);

GlowButton.displayName = "GlowButton";

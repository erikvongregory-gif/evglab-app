import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiCardPadding = "none" | "sm" | "md";

export type StudioUiCardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: StudioUiCardPadding;
  interactive?: boolean;
};

export const StudioUiCard = React.forwardRef<HTMLDivElement, StudioUiCardProps>(
  ({ className, padding = "md", interactive = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "stu-card",
          padding === "sm" && "stu-card--pad-sm",
          padding === "md" && "stu-card--pad-md",
          interactive && "stu-card--interactive",
          className,
        )}
        tabIndex={interactive ? 0 : props.tabIndex}
        {...props}
      />
    );
  },
);
StudioUiCard.displayName = "StudioUiCard";

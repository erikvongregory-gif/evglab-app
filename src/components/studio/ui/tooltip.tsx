"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

export const StudioUiTooltipProvider = TooltipPrimitive.Provider;

export const StudioUiTooltip = TooltipPrimitive.Root;
export const StudioUiTooltipTrigger = TooltipPrimitive.Trigger;

export type StudioUiTooltipContentProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
>;

export const StudioUiTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  StudioUiTooltipContentProps
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("stu-tooltip evg-studio", className)}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
StudioUiTooltipContent.displayName = "StudioUiTooltipContent";

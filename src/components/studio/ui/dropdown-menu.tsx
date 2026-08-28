"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Dropdown-Menü auf Basis von Radix Popover (kein @radix-ui/react-dropdown-menu installiert). */
export const StudioUiDropdownMenu = PopoverPrimitive.Root;
export const StudioUiDropdownMenuTrigger = PopoverPrimitive.Trigger;
export const StudioUiDropdownMenuAnchor = PopoverPrimitive.Anchor;

export type StudioUiDropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
>;

export const StudioUiDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  StudioUiDropdownMenuContentProps
>(({ className, align = "start", sideOffset = 6, collisionPadding = 12, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      role="menu"
      className={cn("stu-menu evg-studio", className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
StudioUiDropdownMenuContent.displayName = "StudioUiDropdownMenuContent";

export type StudioUiDropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export const StudioUiDropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  StudioUiDropdownMenuItemProps
>(({ className, destructive, disabled, onClick, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="menuitem"
    disabled={disabled}
    className={cn("stu-menu__item", destructive && "stu-menu__item--danger", className)}
    onClick={onClick}
    {...props}
  />
));
StudioUiDropdownMenuItem.displayName = "StudioUiDropdownMenuItem";

export function StudioUiDropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("stu-menu__sep", className)} />;
}

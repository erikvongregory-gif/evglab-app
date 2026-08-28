"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@/lib/utils";

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  menuId: string;
  triggerId: string;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

function useMenuContext(component: string) {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error(`${component} requires StudioUiDropdownMenu`);
  return ctx;
}

export type StudioUiDropdownMenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

/** Dropdown-Menü auf Radix Popover mit vollständiger role=menu-Tastaturbedienung. */
export function StudioUiDropdownMenu({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: StudioUiDropdownMenuProps) {
  const isControlled = openProp !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const open = isControlled ? Boolean(openProp) : uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const reactId = React.useId();
  const menuId = `stu-menu-${reactId}`;
  const triggerId = `stu-menu-trigger-${reactId}`;

  const value = React.useMemo(
    () => ({ open, setOpen, menuId, triggerId }),
    [open, setOpen, menuId, triggerId],
  );

  return (
    <MenuContext.Provider value={value}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
    </MenuContext.Provider>
  );
}

export type StudioUiDropdownMenuTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Trigger
>;

export const StudioUiDropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  StudioUiDropdownMenuTriggerProps
>(({ className, ...props }, ref) => {
  const ctx = useMenuContext("StudioUiDropdownMenuTrigger");

  return (
    <PopoverPrimitive.Trigger
      ref={ref}
      id={ctx.triggerId}
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      aria-controls={ctx.menuId}
      className={className}
      {...props}
    />
  );
});
StudioUiDropdownMenuTrigger.displayName = "StudioUiDropdownMenuTrigger";

export const StudioUiDropdownMenuAnchor = PopoverPrimitive.Anchor;

function getEnabledItems(container: HTMLElement | null): HTMLButtonElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])'),
  );
}

function focusItem(items: HTMLButtonElement[], index: number) {
  items.forEach((el, i) => {
    el.tabIndex = i === index ? 0 : -1;
  });
  items[index]?.focus();
}

export type StudioUiDropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
>;

export const StudioUiDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  StudioUiDropdownMenuContentProps
>(
  (
    {
      className,
      align = "start",
      sideOffset = 6,
      collisionPadding = 12,
      onKeyDown,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const ctx = useMenuContext("StudioUiDropdownMenuContent");
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    const setContentRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={setContentRef}
          id={ctx.menuId}
          role="menu"
          aria-labelledby={ctx.triggerId}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn("stu-menu evg-studio", className)}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const items = getEnabledItems(contentRef.current);
            if (items.length) {
              items.forEach((el, i) => {
                el.tabIndex = i === 0 ? 0 : -1;
              });
              items[0]?.focus();
            }
            onOpenAutoFocus?.(e);
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const trigger = document.getElementById(ctx.triggerId);
            trigger?.focus();
            onCloseAutoFocus?.(e);
          }}
          onKeyDown={(e) => {
            const items = getEnabledItems(contentRef.current);
            const currentIndex = items.findIndex((el) => el === document.activeElement);

            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!items.length) return;
              focusItem(items, currentIndex < 0 ? 0 : (currentIndex + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (!items.length) return;
              focusItem(
                items,
                currentIndex < 0
                  ? items.length - 1
                  : (currentIndex - 1 + items.length) % items.length,
              );
            } else if (e.key === "Home") {
              e.preventDefault();
              if (items.length) focusItem(items, 0);
            } else if (e.key === "End") {
              e.preventDefault();
              if (items.length) focusItem(items, items.length - 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              ctx.setOpen(false);
            } else if (e.key === "Tab") {
              ctx.setOpen(false);
            } else if (e.key === "Enter" || e.key === " ") {
              if (currentIndex >= 0) {
                e.preventDefault();
                items[currentIndex]?.click();
              }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              const char = e.key.toLowerCase();
              const start = currentIndex + 1;
              const ordered = [...items.slice(start), ...items.slice(0, start)];
              const match = ordered.find((el) =>
                (el.textContent ?? "").trim().toLowerCase().startsWith(char),
              );
              if (match) {
                e.preventDefault();
                focusItem(items, items.indexOf(match));
              }
            }

            onKeyDown?.(e);
          }}
          {...props}
        />
      </PopoverPrimitive.Portal>
    );
  },
);
StudioUiDropdownMenuContent.displayName = "StudioUiDropdownMenuContent";

export type StudioUiDropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export const StudioUiDropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  StudioUiDropdownMenuItemProps
>(({ className, destructive, disabled, onClick, onFocus, ...props }, ref) => {
  const ctx = useMenuContext("StudioUiDropdownMenuItem");

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      className={cn("stu-menu__item", destructive && "stu-menu__item--danger", className)}
      onFocus={(e) => {
        const root = e.currentTarget.closest('[role="menu"]');
        if (root) {
          root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]').forEach((el) => {
            el.tabIndex = el === e.currentTarget && !el.disabled ? 0 : -1;
          });
        }
        onFocus?.(e);
      }}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.setOpen(false);
      }}
      {...props}
    />
  );
});
StudioUiDropdownMenuItem.displayName = "StudioUiDropdownMenuItem";

export function StudioUiDropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("stu-menu__sep", className)} />;
}

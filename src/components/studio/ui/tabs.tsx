"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: "horizontal" | "vertical";
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export type StudioUiTabsProps = {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
  children: React.ReactNode;
};

export function StudioUiTabs({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
}: StudioUiTabsProps) {
  const baseId = React.useId();
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const current = isControlled ? value : uncontrolled;

  return (
    <TabsContext.Provider
      value={{
        value: current,
        baseId,
        orientation,
        setValue: (next) => {
          if (!isControlled) setUncontrolled(next);
          onValueChange?.(next);
        },
      }}
    >
      <div
        className={cn("stu-tabs", orientation === "vertical" && "stu-tabs--vertical", className)}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function StudioUiTabsList({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(TabsContext);
  const listRef = React.useRef<HTMLDivElement>(null);
  const orientation = ctx?.orientation ?? "horizontal";

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const triggers = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? [],
    );
    if (!triggers.length) return;
    const index = triggers.findIndex((el) => el === document.activeElement);
    if (index < 0) return;

    const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

    let next = index;
    if (e.key === nextKey) next = (index + 1) % triggers.length;
    else if (e.key === prevKey) next = (index - 1 + triggers.length) % triggers.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = triggers.length - 1;
    else return;

    e.preventDefault();
    triggers[next]?.focus();
    const value = triggers[next]?.dataset.value;
    if (value) ctx?.setValue(value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      className={cn("stu-tabs__list", className)}
      onKeyDown={onKeyDown}
      {...props}
    >
      {children}
    </div>
  );
}

export type StudioUiTabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function StudioUiTabsTrigger({
  value,
  className,
  children,
  disabled,
  ...props
}: StudioUiTabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("StudioUiTabsTrigger requires StudioUiTabs");
  const selected = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-value={value}
      data-state={selected ? "active" : "inactive"}
      disabled={disabled}
      className={cn("stu-tabs__trigger", className)}
      onClick={() => ctx.setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export type StudioUiTabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  forceMount?: boolean;
};

export function StudioUiTabsContent({
  value,
  className,
  children,
  forceMount,
  ...props
}: StudioUiTabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("StudioUiTabsContent requires StudioUiTabs");
  const selected = ctx.value === value;
  if (!selected && !forceMount) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      hidden={!selected}
      data-state={selected ? "active" : "inactive"}
      className={cn("stu-tabs__content", className)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
}

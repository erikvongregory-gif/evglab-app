"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiSwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: React.ReactNode;
  className?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export const StudioUiSwitch = React.forwardRef<HTMLButtonElement, StudioUiSwitchProps>(
  (
    {
      checked,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      id,
      label,
      className,
      name,
      ...aria
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const switchId = id ?? generatedId;
    const isControlled = checked !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState(defaultChecked);
    const on = isControlled ? Boolean(checked) : uncontrolled;

    const toggle = () => {
      if (disabled) return;
      const next = !on;
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next);
    };

    return (
      <div className={cn("stu-switch-row", disabled && "stu-switch-row--disabled", className)}>
        {name ? (
          <input type="hidden" name={name} value={on ? "on" : "off"} readOnly />
        ) : null}
        <button
          ref={ref}
          id={switchId}
          type="button"
          role="switch"
          aria-checked={on}
          disabled={disabled}
          className={cn("stu-switch", on && "stu-switch--on")}
          onClick={toggle}
          {...aria}
        >
          <span className="stu-switch__thumb" aria-hidden="true" />
        </button>
        {label ? (
          <label htmlFor={switchId} className="stu-switch__label">
            {label}
          </label>
        ) : null}
      </div>
    );
  },
);
StudioUiSwitch.displayName = "StudioUiSwitch";

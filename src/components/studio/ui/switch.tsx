"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiSwitchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "checked" | "defaultChecked" | "size"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
};

/** Native Checkbox mit Switch-Darstellung — Form-Submit über name/value. */
export const StudioUiSwitch = React.forwardRef<HTMLInputElement, StudioUiSwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      id,
      label,
      value = "on",
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const isControlled = checked !== undefined;

    return (
      <label
        className={cn("stu-switch-row", disabled && "stu-switch-row--disabled", className)}
        htmlFor={inputId}
      >
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          className="stu-switch__input"
          value={value}
          disabled={disabled}
          {...(isControlled
            ? { checked: Boolean(checked) }
            : { defaultChecked: Boolean(defaultChecked) })}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <span className="stu-switch" aria-hidden="true">
          <span className="stu-switch__thumb" />
        </span>
        {label ? <span className="stu-switch__label">{label}</span> : null}
      </label>
    );
  },
);
StudioUiSwitch.displayName = "StudioUiSwitch";

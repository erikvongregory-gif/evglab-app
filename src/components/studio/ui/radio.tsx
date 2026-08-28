"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RadioGroupContextValue = {
  name: string;
  value?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export type StudioUiRadioGroupProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function StudioUiRadioGroup({
  name,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  children,
  ...aria
}: StudioUiRadioGroupProps) {
  const autoName = React.useId();
  const groupName = name ?? autoName;
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const current = isControlled ? value : uncontrolled;

  return (
    <RadioGroupContext.Provider
      value={{
        name: groupName,
        value: current,
        disabled,
        onValueChange: (next) => {
          if (!isControlled) setUncontrolled(next);
          onValueChange?.(next);
        },
      }}
    >
      <div role="radiogroup" className={cn("stu-radio-group", className)} {...aria}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export type StudioUiRadioProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "checked" | "defaultChecked" | "name"
> & {
  value: string;
  label?: React.ReactNode;
};

export const StudioUiRadio = React.forwardRef<HTMLInputElement, StudioUiRadioProps>(
  ({ className, value, label, disabled, id, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const isDisabled = Boolean(disabled || ctx?.disabled);
    const checked = ctx?.value === value;

    return (
      <label
        className={cn("stu-radio", isDisabled && "stu-radio--disabled", className)}
        htmlFor={inputId}
      >
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="radio"
          className="stu-radio__input"
          name={ctx?.name}
          value={value}
          checked={checked}
          disabled={isDisabled}
          onChange={() => ctx?.onValueChange?.(value)}
        />
        <span className="stu-radio__dot" aria-hidden="true" />
        {label ? <span className="stu-radio__label">{label}</span> : null}
      </label>
    );
  },
);
StudioUiRadio.displayName = "StudioUiRadio";

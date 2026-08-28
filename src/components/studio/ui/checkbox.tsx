"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "checked" | "defaultChecked"
> & {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  label?: React.ReactNode;
};

export const StudioUiCheckbox = React.forwardRef<HTMLInputElement, StudioUiCheckboxProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      id,
      label,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const isControlled = checked !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState<boolean | "indeterminate">(
      Boolean(defaultChecked),
    );
    const value: boolean | "indeterminate" = isControlled ? (checked as boolean | "indeterminate") : uncontrolled;

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = value === "indeterminate";
      }
    }, [value]);

    return (
      <label
        className={cn("stu-check", disabled && "stu-check--disabled", className)}
        htmlFor={inputId}
      >
        <input
          {...props}
          ref={inputRef}
          id={inputId}
          type="checkbox"
          className="stu-check__input"
          checked={value === true}
          disabled={disabled}
          aria-checked={value === "indeterminate" ? "mixed" : value === true}
          onChange={(e) => {
            const next = e.target.checked;
            if (!isControlled) setUncontrolled(next);
            onCheckedChange?.(next);
          }}
        />
        <span className="stu-check__box" aria-hidden="true">
          {value === true ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5 L9.5 17 L19 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : value === "indeterminate" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 12 H18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          ) : null}
        </span>
        {label ? <span className="stu-check__label">{label}</span> : null}
      </label>
    );
  },
);
StudioUiCheckbox.displayName = "StudioUiCheckbox";

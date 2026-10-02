"use client";

import { type ReactNode, useId } from "react";
import { cx } from "../../cx";
import { Field } from "./field";

export type SelectOption = string | { value: string; label: string };

export interface SelectFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  options?: SelectOption[];
  /** Shown (disabled) while nothing is chosen. */
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
  name?: string;
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5l5-5' stroke='%234A3B32' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

/** Native select in the pill input style, with a drawn chevron. */
export function SelectField({
  label,
  hint,
  error,
  required,
  disabled,
  options = [],
  placeholder,
  value,
  onChange,
  id,
  name,
}: SelectFieldProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  const messageId = `${fid}-message`;
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fid}
      messageId={messageId}
    >
      <select
        id={fid}
        name={name}
        value={value ?? ""}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className={cx(
          "m-0 box-border w-full cursor-pointer appearance-none rounded-full border-[1.5px] bg-surface bg-[position:right_22px_center] bg-no-repeat py-[13px] pr-[52px] pl-[22px] font-body text-[16px] leading-normal outline-none",
          "transition-[border-color,box-shadow] duration-160 ease-arc focus:ring-4 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60",
          value ? "text-foreground" : "text-muted-foreground",
          error ? "border-destructive" : "border-border focus:border-ring",
        )}
        style={{ backgroundImage: CHEVRON }}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

"use client";

import { cx } from "../../cx";

export interface CheckboxProps {
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

/** Checkbox with a drawn tick and optional description line. */
export function Checkbox({
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
}: CheckboxProps) {
  return (
    <label
      className={cx(
        "relative flex items-start gap-3.5 font-body",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer absolute m-0 size-px opacity-0"
      />
      <span
        aria-hidden="true"
        className={cx(
          "mt-px box-border grid size-[22px] flex-none place-items-center rounded-check border-[1.5px]",
          "transition-[background-color,border-color] duration-160 ease-arc peer-focus-visible:ring-4 peer-focus-visible:ring-focus",
          checked ? "border-primary bg-primary" : "border-input bg-surface",
        )}
      >
        {checked ? (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path
              d="M1 5.2 4.2 8.4 11 1.6"
              stroke="var(--ww-color-primary-foreground)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[16px] leading-[1.4] text-foreground">{label}</span>
        {description ? (
          <span className="text-[14px] leading-[1.4] text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

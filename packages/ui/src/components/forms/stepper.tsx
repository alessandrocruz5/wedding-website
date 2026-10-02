"use client";

import type { ReactNode } from "react";
import { Field } from "./field";

export interface StepperProps {
  label?: ReactNode;
  hint?: ReactNode;
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
}

/** − value + counter, clamped to [min, max]. */
export function Stepper({ label, hint, value = 0, min = 0, max = 10, onChange }: StepperProps) {
  const set = (v: number) => onChange?.(Math.max(min, Math.min(max, v)));
  return (
    <Field label={label} hint={hint}>
      <div className="inline-flex items-center gap-1 self-start rounded-full border-[1.5px] border-border bg-surface p-[5px]">
        <StepperButton label="Decrease" disabled={value <= min} onClick={() => set(value - 1)}>
          −
        </StepperButton>
        <output
          aria-live="polite"
          className="min-w-[52px] text-center font-heading text-[30px] leading-none font-medium text-foreground"
        >
          {value}
        </output>
        <StepperButton label="Increase" disabled={value >= max} onClick={() => set(value + 1)}>
          +
        </StepperButton>
      </div>
    </Field>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 font-body text-[22px] leading-none font-light text-foreground transition-colors duration-160 ease-arc hover:not-disabled:bg-muted focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

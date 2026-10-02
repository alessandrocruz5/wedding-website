"use client";

import { type ReactNode, useId } from "react";
import { cx } from "../../cx";
import { Field } from "./field";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

export type ChoiceVariant = "pill" | "arch" | "card";

export interface ChoiceGroupProps {
  label?: ReactNode;
  name?: string;
  options?: (string | ChoiceOption)[];
  value?: string;
  onChange?: (value: string) => void;
  /** `pill` wraps inline; `arch` and `card` lay out in a grid. */
  variant?: ChoiceVariant;
  columns?: number;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

/** Radio group as pills, tall arches (the RSVP accept/decline) or cards with descriptions. */
export function ChoiceGroup({
  label,
  name,
  options = [],
  value,
  onChange,
  variant = "pill",
  columns,
  hint,
  error,
  required,
}: ChoiceGroupProps) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const cols = columns ?? Math.min(opts.length, 3);
  return (
    <Field as="fieldset" label={label} hint={hint} error={error} required={required}>
      <div
        role="radiogroup"
        className={variant === "pill" ? "flex flex-wrap gap-2.5" : "grid gap-3.5"}
        style={
          variant === "pill"
            ? undefined
            : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
        }
      >
        {opts.map((o) => (
          <ChoiceItem
            key={o.value}
            name={groupName}
            option={o}
            variant={variant}
            checked={value === o.value}
            onSelect={() => onChange?.(o.value)}
          />
        ))}
      </div>
    </Field>
  );
}

const itemBase =
  "relative box-border cursor-pointer border-[1.5px] font-body transition-[background-color,border-color,color] duration-280 ease-arc has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-focus";

function ChoiceItem({
  name,
  option,
  variant,
  checked,
  onSelect,
}: {
  name: string;
  option: ChoiceOption;
  variant: ChoiceVariant;
  checked: boolean;
  onSelect: () => void;
}) {
  const input = (
    <input
      type="radio"
      name={name}
      value={option.value}
      checked={checked}
      onChange={onSelect}
      className="pointer-events-none absolute m-0 size-px opacity-0"
    />
  );

  if (variant === "pill") {
    return (
      <label
        className={cx(
          itemBase,
          "rounded-full px-[22px] py-[11px] text-[15px] leading-[1.3]",
          checked
            ? "border-inverse bg-inverse text-inverse-foreground"
            : "border-input bg-surface text-foreground hover:border-ink-soft",
        )}
      >
        {input}
        {option.label}
      </label>
    );
  }

  if (variant === "arch") {
    return (
      <label
        className={cx(
          itemBase,
          "flex min-h-[210px] flex-col items-center justify-end gap-1.5 rounded-arch-soft px-[18px] pt-11 pb-[26px] text-center",
          checked
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface text-foreground hover:border-ink-soft",
        )}
      >
        {input}
        <span
          aria-hidden="true"
          className={cx(
            "mb-auto grid size-[26px] place-items-center rounded-full border-[1.5px]",
            checked ? "border-accent-foreground" : "border-input",
          )}
        >
          {checked ? <span className="size-3 rounded-full bg-accent-foreground" /> : null}
        </span>
        <span className="font-heading text-[27px] leading-[1.1] italic">{option.label}</span>
        {option.description ? (
          <span
            className={cx(
              "text-[13px] leading-[1.4]",
              checked ? "text-calm" : "text-muted-foreground",
            )}
          >
            {option.description}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <label
      className={cx(
        itemBase,
        "flex items-start gap-3.5 rounded-card px-5 py-4 text-foreground",
        checked ? "border-ring bg-primary-soft" : "border-border bg-surface hover:border-ink-soft",
      )}
    >
      {input}
      <span
        aria-hidden="true"
        className={cx(
          "mt-0.5 grid size-[22px] flex-none place-items-center rounded-full border-[1.5px] bg-surface",
          checked ? "border-primary" : "border-input",
        )}
      >
        {checked ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[16px] leading-[1.35] font-medium">{option.label}</span>
        {option.description ? (
          <span className="text-[14px] leading-[1.4] text-muted-foreground">
            {option.description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

import type { ComponentProps } from "react";
import { cx } from "../../cx";

const variants = {
  primary:
    "border-transparent bg-primary text-primary-foreground hover:not-disabled:bg-primary-hover",
  secondary: "border-ink-soft bg-transparent text-foreground hover:not-disabled:bg-muted",
  soft: "border-transparent bg-calm text-calm-foreground hover:not-disabled:bg-calm-strong",
  inverse: "border-transparent bg-surface text-foreground hover:not-disabled:bg-muted",
  ghost: "border-transparent bg-transparent text-primary hover:not-disabled:underline",
} as const;

// Horizontal padding is kept apart so the ghost variant can tighten it without a class clash.
const sizes = {
  sm: { y: "py-[9px] text-[12px]", x: "px-[18px]" },
  md: { y: "py-[14px] text-[13px]", x: "px-7" },
  lg: { y: "py-[18px] text-[14px]", x: "px-[38px]" },
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Button classes, for elements that must look like a button but aren't one (e.g. a `<Link>`). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cx(
    fullWidth ? "flex w-full" : "inline-flex",
    "cursor-pointer items-center justify-center gap-2.5 rounded-full border-[1.5px] font-body leading-[1.2] font-medium tracking-button whitespace-nowrap uppercase no-underline underline-offset-[5px]",
    "transition-[background-color,transform] duration-160 ease-arc active:not-disabled:scale-[0.98]",
    "focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-45",
    sizes[size].y,
    variant === "ghost" ? "px-2" : sizes[size].x,
    variants[variant],
    className,
  );
}

export type ButtonProps = ComponentProps<"button"> & Omit<ButtonStyleOptions, "className">;

/** Pill button. Labels are sentence case in source; CSS renders them uppercase. */
export function Button({
  variant,
  size,
  fullWidth,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}

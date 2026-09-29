import type { ComponentProps } from "react";
import { cx } from "../cx";

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-transparent text-foreground hover:bg-muted",
} as const;

export type ButtonProps = ComponentProps<"button"> & { variant?: keyof typeof variants };

/** Disposable primitive — proves the token seam until the Claude Design import replaces it. */
export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

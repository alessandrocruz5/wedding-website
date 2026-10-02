import type { ComponentProps, CSSProperties } from "react";
import { cx } from "../../cx";

const variants = {
  surface: "rounded-card border border-border bg-surface text-surface-foreground shadow-sm",
  sunken: "rounded-card border border-transparent bg-muted text-foreground",
  outline: "rounded-card border-[1.5px] border-input bg-transparent text-foreground",
  // Elliptical dome top; the extra top padding clears the curve.
  arch: "rounded-arch-soft border border-border bg-surface pt-[calc(var(--card-pad)+40px)] text-center text-surface-foreground shadow-sm",
  inverse: "rounded-card border border-transparent bg-inverse text-inverse-foreground",
} as const;

export type CardVariant = keyof typeof variants;

export type CardProps = ComponentProps<"div"> & {
  variant?: CardVariant;
  /** Inner padding in px. */
  padding?: number;
};

export function Card({ variant = "surface", padding = 32, className, style, ...props }: CardProps) {
  return (
    <div
      className={cx("box-border p-(--card-pad) font-body", variants[variant], className)}
      style={{ "--card-pad": `${padding}px`, ...style } as CSSProperties}
      {...props}
    />
  );
}

import type { ComponentProps } from "react";
import { cx } from "../../cx";

const tones = {
  neutral: "bg-muted text-ink-soft",
  sage: "bg-calm text-calm-foreground",
  clay: "bg-primary-soft text-primary-hover",
  ochre: "bg-ochre text-ochre-foreground",
  dark: "bg-inverse text-inverse-foreground",
} as const;

export type BadgeTone = keyof typeof tones;

export type BadgeProps = ComponentProps<"span"> & { tone?: BadgeTone };

/** Small uppercase pill for attire, room blocks and RSVP status. */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] font-body text-[11px] leading-[1.3] font-medium tracking-badge whitespace-nowrap uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

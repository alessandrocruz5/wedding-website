import type { CSSProperties } from "react";
import { cx } from "../../cx";

const shapes = {
  arch: "rounded-arch",
  soft: "rounded-arch-soft",
  circle: "rounded-full",
  pill: "rounded-full",
  rounded: "rounded-panel",
} as const;

// [ground, stripe, label text] for the diagonal-striped placeholder.
const tones = {
  sand: ["var(--ww-color-muted)", "var(--ww-color-border)", "text-muted-foreground"],
  sage: ["var(--color-calm)", "var(--color-calm-strong)", "text-calm-foreground"],
  clay: ["var(--color-clay-soft)", "var(--color-clay-light)", "text-primary-hover"],
} as const;

export interface ArchFrameProps {
  /** Image URL. Without it, a striped placeholder with `label` is shown. */
  src?: string;
  alt?: string;
  shape?: keyof typeof shapes;
  /** Width ÷ height. Ignored for circles. */
  aspect?: number;
  label?: string;
  tone?: keyof typeof tones;
  /** Thin linen line inside the edge. */
  inset?: boolean;
  /** Clay outline offset up and to the right. */
  offset?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Image frame in one of the arch shapes; arches are the system's motif. */
export function ArchFrame({
  src,
  alt = "",
  shape = "arch",
  aspect = 0.75,
  label = "Photo",
  tone = "sand",
  inset = false,
  offset = false,
  className,
  style,
}: ArchFrameProps) {
  const radius = shapes[shape];
  const [ground, stripe, labelText] = tones[tone];
  const layer = cx("absolute box-border overflow-hidden", radius);
  return (
    <div
      className={cx("relative w-full", className)}
      style={{ aspectRatio: String(shape === "circle" ? 1 : aspect), ...style }}
    >
      {offset ? (
        <div
          aria-hidden="true"
          className={cx(
            layer,
            "inset-0 translate-x-3.5 -translate-y-3.5 border-[1.5px] border-ornament",
          )}
        />
      ) : null}
      <div
        className={cx(layer, "inset-0")}
        style={{
          background: src
            ? ground
            : `repeating-linear-gradient(135deg, ${ground} 0 14px, ${stripe} 14px 15px)`,
        }}
      >
        {src ? (
          <img src={src} alt={alt} className="block size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span
              className={cx(
                "rounded-full bg-surface px-2.5 py-[5px] font-mono text-[11px] tracking-[0.08em] uppercase",
                labelText,
              )}
            >
              {label}
            </span>
          </div>
        )}
      </div>
      {inset ? (
        <div aria-hidden="true" className={cx(layer, "inset-2.5 border border-surface/80")} />
      ) : null}
    </div>
  );
}

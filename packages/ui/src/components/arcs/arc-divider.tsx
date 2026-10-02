import type { CSSProperties } from "react";

export interface ArcDividerProps {
  /** `arc` swag with a dot, `scallop` section edge, `rule` line with a small arch, `nested` arches. */
  variant?: "arc" | "scallop" | "rule" | "nested";
  /** Any CSS colour; the scallop should match the band it tops. */
  color?: string;
  /** Width in px (arc and rule). */
  width?: number;
  className?: string;
  style?: CSSProperties;
}

/** Decorative arc ornaments. Always hidden from assistive tech. */
export function ArcDivider({
  variant = "arc",
  color = "var(--color-ornament)",
  width = 280,
  className,
  style,
}: ArcDividerProps) {
  if (variant === "scallop") {
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          height: 14,
          width: "100%",
          background: `radial-gradient(circle at 14px 14px, ${color} 13.5px, transparent 14px) 0 0 / 28px 14px repeat-x`,
          ...style,
        }}
      />
    );
  }
  if (variant === "rule") {
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width,
          maxWidth: "100%",
          margin: "0 auto",
          ...style,
        }}
      >
        <span style={{ flex: 1, height: 1, background: color }} />
        <svg width="36" height="18" viewBox="0 0 36 18" fill="none">
          <path d="M1 17A17 17 0 0 1 35 17" stroke={color} strokeWidth="1.5" />
        </svg>
        <span style={{ flex: 1, height: 1, background: color }} />
      </div>
    );
  }
  if (variant === "nested") {
    return (
      <svg
        aria-hidden="true"
        width="72"
        height="38"
        viewBox="0 0 72 38"
        fill="none"
        className={className}
        style={{ display: "block", margin: "0 auto", ...style }}
      >
        <path d="M1 37A35 35 0 0 1 71 37" stroke={color} strokeWidth="1.5" />
        <path d="M13 37A23 23 0 0 1 59 37" stroke={color} strokeWidth="1.5" />
        <path d="M25 37A11 11 0 0 1 47 37" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={width * 0.12}
      viewBox="0 0 280 34"
      fill="none"
      className={className}
      style={{ display: "block", margin: "0 auto", maxWidth: "100%", ...style }}
    >
      <path d="M2 32Q140 -28 278 32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="140" cy="14" r="3" fill={color} />
    </svg>
  );
}

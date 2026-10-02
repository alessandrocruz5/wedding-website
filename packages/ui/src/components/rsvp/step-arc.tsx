export interface StepArcProps {
  /** Step labels (the current one is shown large), or just a count. */
  steps: string[] | number;
  /** Zero-based. */
  current?: number;
}

const R = 88;
const CX = 100;
const CY = 96;
const ARC_LENGTH = Math.PI * R;
const ARC_PATH = `M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`;

/** Semicircle progress: a clay arc that draws across the steps. */
export function StepArc({ steps, current = 0 }: StepArcProps) {
  const labels = Array.isArray(steps) ? steps : null;
  const n = labels ? labels.length : (steps as number);
  const pct = n > 1 ? current / (n - 1) : 1;
  const points = Array.from({ length: n }, (_, i) => {
    const a = Math.PI - Math.PI * (n > 1 ? i / (n - 1) : 0);
    return [CX + R * Math.cos(a), CY - R * Math.sin(a)] as const;
  });
  return (
    <div className="flex flex-col items-center">
      <svg
        width="200"
        height="104"
        viewBox="0 0 200 104"
        fill="none"
        className="overflow-visible"
        aria-hidden="true"
      >
        <path d={ARC_PATH} stroke="var(--ww-color-border)" strokeWidth="1.5" />
        <path
          d={ARC_PATH}
          stroke="var(--color-clay-bright)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={ARC_LENGTH * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-640 ease-arc"
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === current ? 7 : 5}
            fill={i <= current ? "var(--color-clay-bright)" : "var(--ww-color-surface)"}
            stroke={i <= current ? "var(--color-clay-bright)" : "var(--ww-color-input)"}
            strokeWidth="1.5"
            className="transition-all duration-280 ease-arc"
          />
        ))}
      </svg>
      <div className="-mt-[38px] flex flex-col items-center gap-5 text-center">
        <span className="font-body text-[11px] font-medium tracking-eyebrow text-muted-foreground uppercase">
          Step {current + 1} of {n}
        </span>
        {labels ? (
          <span className="font-heading text-[36px] leading-[1.1] font-normal text-foreground">
            {labels[current]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

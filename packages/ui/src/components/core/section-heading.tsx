import type { ReactNode } from "react";
import { cx } from "../../cx";

const titleSizes = { lg: "text-display-lg", md: "text-h1", sm: "text-h2" } as const;

export interface SectionHeadingProps {
  eyebrow?: ReactNode;
  /** Wrap one phrase in `<em>` for the italic accent. */
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  size?: keyof typeof titleSizes;
  /** For dark or accent grounds: title and subtitle take the ground's text colour. */
  inverse?: boolean;
  as?: "h1" | "h2" | "h3";
}

/** Eyebrow, display title and lead paragraph: the opening of every section. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  size = "lg",
  inverse = false,
  as: Tag = "h2",
}: SectionHeadingProps) {
  const center = align === "center";
  return (
    <div
      className={cx(
        "flex max-w-[720px] flex-col gap-4",
        center ? "mx-auto items-center text-center" : "items-start text-left",
      )}
    >
      {eyebrow ? (
        <div
          className={cx(
            "font-body text-eyebrow font-medium tracking-eyebrow uppercase",
            inverse ? "text-clay-light" : "text-primary",
          )}
        >
          {eyebrow}
        </div>
      ) : null}
      <Tag
        className={cx(
          "m-0 font-heading leading-[1.05] font-normal tracking-display text-balance",
          titleSizes[size],
          inverse ? "text-inherit" : "text-foreground",
        )}
      >
        {title}
      </Tag>
      {subtitle ? (
        <p
          className={cx(
            "m-0 max-w-[560px] font-body text-body-lg font-light text-pretty",
            inverse ? "text-inherit opacity-85" : "text-ink-soft",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

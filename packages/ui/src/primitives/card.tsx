import type { ComponentProps } from "react";
import { cx } from "../cx";

/** Disposable primitive — proves the token seam until the Claude Design import replaces it. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-lg border border-border bg-surface p-6 text-surface-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

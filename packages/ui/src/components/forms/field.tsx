import type { ReactNode } from "react";

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  /** Replaces the hint and is announced. */
  error?: ReactNode;
  required?: boolean;
  /** The control's id (`label[for]`); ignored for fieldsets. */
  htmlFor?: string;
  /** id for the hint/error line, for the control's `aria-describedby`. */
  messageId?: string;
  /** `fieldset` groups radios/checkboxes under a `legend`. */
  as?: "div" | "fieldset";
  children: ReactNode;
}

/** Label, control, then hint or error: the frame around every form control. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  messageId,
  as = "div",
  children,
}: FieldProps) {
  const isSet = as === "fieldset";
  const Tag = isSet ? "fieldset" : "div";
  const labelClass =
    "p-0 font-body text-eyebrow font-medium tracking-label text-ink-soft uppercase";
  const labelContent = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="ml-1 text-primary">
          *
        </span>
      ) : null}
    </>
  );
  return (
    <Tag className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      {label ? (
        isSet ? (
          <legend className={`${labelClass} mb-2`}>{labelContent}</legend>
        ) : (
          <label htmlFor={htmlFor} className={labelClass}>
            {labelContent}
          </label>
        )
      ) : null}
      {children}
      {error || hint ? (
        <span
          id={messageId}
          role={error ? "alert" : undefined}
          className={`pl-1 font-body text-[13px] leading-[1.4] ${error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {error || hint}
        </span>
      ) : null}
    </Tag>
  );
}

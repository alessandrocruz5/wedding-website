"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { cx } from "../../cx";
import { Field } from "./field";

interface TextFieldOwnProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export type TextFieldProps =
  | (TextFieldOwnProps & { multiline?: false } & ComponentProps<"input">)
  | (TextFieldOwnProps & { multiline: true } & ComponentProps<"textarea">);

/** Pill text input, or a rounded textarea with `multiline`. */
export function TextField(props: TextFieldProps) {
  const autoId = useId();
  const { label, hint, error, required, id, className } = props;
  const fid = id ?? autoId;
  const messageId = `${fid}-message`;
  const controlClass = cx(
    "m-0 box-border w-full border-[1.5px] bg-surface px-[22px] font-body text-[16px] leading-normal text-foreground outline-none",
    "transition-[border-color,box-shadow] duration-160 ease-arc placeholder:text-muted-foreground",
    "focus:ring-4 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60",
    error ? "border-destructive" : "border-border focus:border-ring",
    props.multiline ? "resize-y rounded-card py-4" : "rounded-full py-[13px]",
    className,
  );
  const shared = {
    id: fid,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? messageId : undefined,
    className: controlClass,
  };
  let control: ReactNode;
  if (props.multiline) {
    const { label: _l, hint: _h, error: _e, multiline: _m, rows = 4, ...rest } = props;
    control = <textarea rows={rows} {...rest} {...shared} />;
  } else {
    const { label: _l, hint: _h, error: _e, multiline: _m, ...rest } = props;
    control = <input {...rest} {...shared} />;
  }
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fid}
      messageId={messageId}
    >
      {control}
    </Field>
  );
}

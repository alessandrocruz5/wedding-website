import { cx } from "../../cx";

export interface NamesProps {
  /** "Maya & Theo". Without exactly one "&" the name is set as-is. */
  names: string;
  /** Size and colour utilities, e.g. `text-display-xl`. */
  className?: string;
}

/** The wordmark: the couple's names in the display face with an italic clay ampersand. */
export function Names({ names, className }: NamesProps) {
  const parts = names.split("&").map((s) => s.trim());
  return (
    <span className={cx("font-heading leading-none font-normal tracking-display", className)}>
      {parts.length === 2 && parts[0] && parts[1] ? (
        <>
          {parts[0]} <em className="font-normal text-clay-bright">&amp;</em> {parts[1]}
        </>
      ) : (
        names
      )}
    </span>
  );
}

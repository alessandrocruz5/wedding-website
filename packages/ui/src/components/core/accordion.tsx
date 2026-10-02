import type { ReactNode } from "react";

export interface AccordionItem {
  question: ReactNode;
  answer: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Index open on first paint; -1 for none. */
  defaultOpen?: number;
  /** Groups the items so one opening closes the others. Must be unique per page. */
  name?: string;
}

/**
 * FAQ list. Native exclusive `<details name>`, so it needs no client JS; the "+" turns to "×"
 * when open.
 */
export function Accordion({ items, defaultOpen = 0, name = "accordion" }: AccordionProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <details
          key={i}
          name={name}
          open={i === defaultOpen}
          className="group rounded-card border border-border transition-colors duration-280 ease-arc open:bg-surface"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card py-[18px] pr-5 pl-[26px] font-heading text-[23px] leading-[1.25] font-medium text-foreground focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span
              aria-hidden="true"
              className="grid size-9 flex-none place-items-center rounded-full border-[1.5px] border-input font-body text-[20px] leading-none font-light transition-transform duration-280 ease-arc group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="max-w-text px-[26px] pb-[22px] font-body text-[16px] leading-[1.65] text-pretty text-ink-soft">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}

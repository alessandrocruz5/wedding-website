import { buttonClasses, Names } from "@ww/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type SitePage = "home" | "schedule" | "travel" | "rsvp";

const PATHS: Record<SitePage, string> = {
  home: "",
  schedule: "/schedule",
  travel: "/travel",
  rsvp: "/rsvp",
};

/** A site page's URL under the site's base path (`""` or `/s/{slug}`). */
export function sitePath(base: string, page: SitePage): string {
  return `${base}${PATHS[page]}` || "/";
}

interface ChromeProps {
  names: string;
  base: string;
  current: SitePage;
  dateLine: string;
}

function SiteNav({ names, base, current }: Omit<ChromeProps, "dateLine">) {
  const links: [SitePage, string][] = [
    ["home", "Home"],
    ["schedule", "Schedule"],
    ["travel", "Travel & FAQ"],
  ];
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-6 py-3">
        <Link href={sitePath(base, "home")} className="text-foreground no-underline">
          <Names names={names} className="text-[28px]" />
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map(([page, label]) => (
            <Link
              key={page}
              href={sitePath(base, page)}
              aria-current={current === page ? "page" : undefined}
              className={`rounded-full px-4 py-[9px] font-body text-eyebrow font-medium tracking-button text-foreground uppercase no-underline transition-colors duration-160 ease-arc focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none ${current === page ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={sitePath(base, "rsvp")}
            aria-current={current === "rsvp" ? "page" : undefined}
            className={buttonClasses({
              size: "sm",
              variant: current === "rsvp" ? "secondary" : "primary",
              className: "ml-2",
            })}
          >
            RSVP
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter({ names, base, dateLine }: Omit<ChromeProps, "current">) {
  const links: [SitePage, string][] = [
    ["schedule", "Schedule"],
    ["travel", "Travel & FAQ"],
    ["rsvp", "RSVP"],
  ];
  return (
    <footer className="flex flex-col items-center gap-5 rounded-dome bg-inverse px-6 pt-[120px] pb-14 text-center text-inverse-foreground">
      <Names names={names} className="text-[56px]" />
      <span className="text-eyebrow font-medium tracking-eyebrow text-inverse-muted uppercase">
        {dateLine}
      </span>
      <div className="mt-3 flex flex-wrap justify-center gap-5">
        {links.map(([page, label]) => (
          <Link
            key={page}
            href={sitePath(base, page)}
            className="text-small text-clay-light underline underline-offset-4 hover:text-inverse-foreground"
          >
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}

/** Sticky nav, page content and the bark dome footer around every public site page. */
export function SiteShell({ children, ...chrome }: ChromeProps & { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteNav names={chrome.names} base={chrome.base} current={chrome.current} />
      <main>{children}</main>
      <SiteFooter names={chrome.names} base={chrome.base} dateLine={chrome.dateLine} />
    </div>
  );
}

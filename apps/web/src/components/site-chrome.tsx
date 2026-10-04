import { buttonClasses, Names } from "@ww/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { getShowcase } from "@/lib/tenant-context";

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
  const links: [SitePage, ReactNode][] = [
    ["home", "Home"],
    ["schedule", "Schedule"],
    ["travel", <>Travel<span className="max-sm:hidden"> &amp; FAQ</span></>],
  ];
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
        <Link href={sitePath(base, "home")} className="text-foreground no-underline">
          <Names names={names} className="text-[28px]" />
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {links.map(([page, label]) => (
            <Link
              key={page}
              href={sitePath(base, page)}
              aria-current={current === page ? "page" : undefined}
              className={`rounded-full px-2.5 py-[9px] sm:px-4 font-body text-eyebrow font-medium tracking-button text-foreground uppercase no-underline transition-colors duration-160 ease-arc focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none ${current === page ? "bg-muted" : "hover:bg-muted/60"}`}
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
              className: "ml-1 sm:ml-2",
            })}
          >
            RSVP
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Demo-only strip (SHOWCASE_MODE=1) so visitors know the site is a showcase, with a way out. */
function ShowcaseBanner() {
  const { enabled, landingHref } = getShowcase();
  if (!enabled) return null;
  return (
    <div className="bg-inverse px-4 py-2 text-center text-small text-inverse-foreground">
      This is a demo wedding site.{" "}
      <a href={landingHref} className="text-clay-light underline hover:text-inverse-foreground">
        Back to the platform
      </a>
    </div>
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
      <ShowcaseBanner />
      <SiteNav names={chrome.names} base={chrome.base} current={chrome.current} />
      <main>{children}</main>
      <SiteFooter names={chrome.names} base={chrome.base} dateLine={chrome.dateLine} />
    </div>
  );
}

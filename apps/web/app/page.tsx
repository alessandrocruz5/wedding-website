import Link from "next/link";
import { DEMOS, REPO_URL } from "../src/content/demos";

const HIGHLIGHTS = [
  {
    title: "Shared-schema multi-tenancy",
    body: "One database, one schema. Every tenant-owned table carries a site_id; a site is resolved from the host, a custom domain, or /s/{slug}.",
  },
  {
    title: "Postgres row-level security",
    body: "Isolation is enforced in the database, not the app. The app role has NOBYPASSRLS and every query runs scoped to one site, so a missing WHERE can't leak another couple's data.",
  },
  {
    title: "Token-based theming",
    body: "A site's look is a validated set of --ww-* design tokens stored per site. Presets and overrides change colour and type without touching components.",
  },
];

/**
 * Platform host only: tenant hosts, pinned deploys and default-site mode (DEFAULT_SITE_SLUG) are
 * rewritten away from `/` by middleware, so this page is never reached in those modes.
 */
export default function PlatformHome() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-16 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Portfolio project</p>
        <h1 className="text-5xl">Whitelabel wedding sites</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A multi-tenant platform that serves many couples&rsquo; wedding sites from one codebase
          and one database, each with its own theme, domain and content. The same app also runs as a
          single-client deploy.
        </p>
      </header>

      <section aria-labelledby="demos" className="flex flex-col gap-6">
        <h2 id="demos" className="text-3xl">
          Live demos
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {DEMOS.map((demo) => (
            <li key={demo.slug}>
              <Link
                href={`/s/${demo.slug}`}
                className="flex h-full flex-col gap-2 rounded-lg border p-5 transition-colors hover:bg-muted"
              >
                <span className="text-xl">{demo.name}</span>
                <span className="text-sm text-muted-foreground">{demo.blurb}</span>
                <span className="mt-auto pt-2 text-sm">Preset: {demo.preset} &rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="architecture" className="flex flex-col gap-6">
        <h2 id="architecture" className="text-3xl">
          Architecture highlights
        </h2>
        <dl className="grid gap-6 sm:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="flex flex-col gap-2">
              <dt className="text-xl">{h.title}</dt>
              <dd className="text-sm text-muted-foreground">{h.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer>
        <a href={REPO_URL} className="underline underline-offset-4" rel="noopener">
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}

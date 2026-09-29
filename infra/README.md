# Infrastructure

Where the app runs, how it's wired, and why. Day-to-day procedures (deploy, migrate, roll back,
domains) are in [docs/runbook.md](../docs/runbook.md).

## Topology

| Piece          | Where                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| App            | One Vercel project, **Root Directory `apps/web`**. Functions in `sin1` (Singapore); Edge middleware runs globally.   |
| Build config   | [`apps/web/vercel.json`](../apps/web/vercel.json). Vercel reads it from the Root Directory, not the repo root.       |
| Database       | One Neon project in `aws-ap-southeast-1` (same metro as `sin1`).                                                     |
| Neon branches  | `main` = production · `dev` = local development · `preview` = child of `dev`, shared by every Vercel preview deploy. |
| Build cache    | Vercel Remote Cache (Turborepo), shared by Vercel builds, CI and local.                                              |
| Deploy trigger | Vercel's Git integration: every pushed branch → Preview, `main` → Production.                                        |

## Environment matrix

Set in Vercel → Project → Settings → Environment Variables. **Each row is a separate entry per
environment.** Never add one entry that targets both Production and Preview.

| Variable               | Production                         | Preview                               | Development (local `apps/web/.env.local`) |
| ---------------------- | ---------------------------------- | ------------------------------------- | ----------------------------------------- |
| `DATABASE_URL`         | `ww_app_login` @ `main` **pooler** | `ww_app_login` @ `preview` **pooler** | `ww_app_login` @ `dev` pooler             |
| `ROOT_DOMAIN`          | `<ROOT_DOMAIN>`                    | `<ROOT_DOMAIN>` (unused while pinned) | `localhost`                               |
| `SINGLE_TENANT_SLUG`   | _unset_ (multi-tenant)             | `ana-and-ben`                         | _unset_                                   |
| `MIGRATE_DATABASE_URL` | **never set on Vercel**            | **never set on Vercel**               | only in `packages/db/.env`, per branch    |

Record the Neon endpoint of each branch here once created, so the preview check in the runbook
has something to compare against:

| Branch    | Endpoint (the `ep-…` part of the host) |
| --------- | -------------------------------------- |
| `main`    | `<ep-main>`                            |
| `preview` | `<ep-preview>`                         |
| `dev`     | `<ep-dev>`                             |

### Invariants

- **The app connects only as `ww_app_login`** (member of `ww_app`, `NOBYPASSRLS`). The owner role
  bypasses RLS; it's used for migrations and the seed, from a laptop, and never reaches Vercel.
- **Preview never points at `main`.** A preview deploy writing to production silently corrupts
  real data, and from Sprint 3 onward it would also leak guest PII. The runbook's pre-merge check
  verifies this.
- **The build reads no env.** `DATABASE_URL`, `ROOT_DOMAIN` and `SINGLE_TENANT_SLUG` are read at
  request time. Turborepo's strict env mode (the default) strips any variable not declared in
  `turbo.json` from `next build`, so a build can't reach a database even though Vercel exposes
  project variables at build time. Vercel's build log warns that these three variables are
  "missing from turbo.json". That's expected, so don't "fix" it by adding them to the `build` task.
- **Previews are pinned to one demo site.** Preview hosts (`*.vercel.app`) aren't platform hosts,
  so without the pin every preview request would resolve as an unknown custom domain and 404.
  Multi-tenant routing is covered by the `resolve-host` tests and by production.
- Preview deploys keep Vercel's default Deployment Protection (Vercel login required), and Vercel
  sends `X-Robots-Tag: noindex` on them.

## Caching

- **Site pages:** ISR per site key (`revalidate = 300`, nothing prebuilt). Middleware rewrites to
  `/sites/{key}/…`, where the key includes the host (`h.{hostname}`) or slug (`s.{slug}`), and
  Vercel's CDN cache is keyed by host. So one tenant's page is never served to another. Next
  emits `s-maxage=300, stale-while-revalidate=…`. Data is cached under tag `ww-site`, which
  Sprint 4's editor revalidates on write.
- **API routes:** `Cache-Control: no-store`, forced in `apps/web/next.config.ts`. A header set
  there overrides the route's own, so making an API route cacheable takes an explicit exception
  in that file.
- **Static assets:** `/_next/static/*` is immutable (Next's default).

## Remote cache

- **Vercel builds:** zero-config. The project is on the same Vercel account as the cache.
- **CI:** [`ci.yml`](../.github/workflows/ci.yml) exchanges a GitHub OIDC token for a short-lived
  Turborepo token (`vercel/setup-turborepo-remote-cache-action`), so no long-lived token is
  stored. The step is skipped until the `TURBO_TEAM` repository variable exists, so CI works
  without it, just uncached.
- **Local:** `pnpm turbo login && pnpm turbo link`.

## Domains

- **Platform:** apex `<ROOT_DOMAIN>` plus wildcard `*.<ROOT_DOMAIN>` on the Vercel project.
  `{slug}.<ROOT_DOMAIN>` serves that site, and the apex serves `/s/{slug}`. **Wildcard
  certificates need the domain's nameservers to be Vercel's** (`ns1.vercel-dns.com`,
  `ns2.vercel-dns.com`).
- **Client custom domains:** added one by one to the Vercel project, plus a `site_domains` row.
  The client points a CNAME (subdomain) or an A record (apex) at Vercel.

## One-time setup

1. **Neon:** create branch `preview` from `dev`. The `ww_app_login` role and its password come
   with it. Confirm it holds only the demo seed. Record its endpoint above.
2. **Vercel project:** import the GitHub repo and set Root Directory `apps/web`. Framework, build
   command and region come from `vercel.json`. Set Node.js to 22.x (matches `.nvmrc`).
3. **Env vars:** add the matrix above, one entry per environment. Leave `DATABASE_URL` as a
   regular encrypted variable, not "Sensitive": Sensitive values can't be read back, which
   makes the preview check impossible.
4. **Domains:** add `<ROOT_DOMAIN>` and `*.<ROOT_DOMAIN>`, then move the nameservers to Vercel.
5. **Remote cache in CI:** in Vercel team settings, create an OIDC policy for
   `alessandrocruz5/wedding-website`. Then add the repository variable
   `TURBO_TEAM=<vercel team slug>` (GitHub → Settings → Secrets and variables → Actions →
   Variables).
6. **Local CLI:** `cd apps/web && vercel link` (writes `.vercel/`, gitignored).

## Plan and cost notes

- **Vercel Hobby is non-commercial only.** Serving paying clients needs Pro.
- The Neon free plan caps branches and compute hours. One shared `preview` branch fits inside it.

## Decisions

- **One shared `preview` branch, not per-PR branches.** It needs no CI secrets, has nothing to
  clean up, and fits the free plan. The cost is that open PRs share one database, including its
  migrations. That's fine while PRs are sequential and there's one developer.
  **When to move to per-PR branches:** concurrent PRs with migrations, or more contributors. The
  upgrade: GitHub Actions creates a Neon branch per PR (`neondatabase/create-branch-action`),
  migrates it, deploys the preview with the Vercel CLI and a branch-scoped `DATABASE_URL`, and
  deletes the branch when the PR closes.
- **Neon's Vercel integration is rejected.** Its automatic preview branches connect as the
  owner role (bypassing RLS, so previews would run without tenant isolation) and branch from
  production data.

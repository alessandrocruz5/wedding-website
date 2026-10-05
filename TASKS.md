# Wedding Website — Sprints
Status: [ ] planned · [~] in progress · [x] merged · [-] cancelled (excluded from changelog)

> Keys below are placeholders (`WW-?n`). Replace each with the real Jira key once the Epic
> and its children exist in project **WW**.

## Sprint 4 — Portfolio launch polish   (planned 2026-10-06)
Epic: WW-20

**Locked decisions** (approved 2026-10-06 — do not re-litigate)
- Free tiers only, no schema changes, no real guest data. Video demo is out of scope. Branch base is `develop`.
- Localhost fix: `export const dynamic = "force-dynamic"` on the prerendered routes. Don't add `ROOT_DOMAIN` to the turbo build env; WW-7's "nothing read at build" contract stands.
- `DEFAULT_SITE_SLUG=ana-and-ben` in Vercel Production (Sprint 3 decision kept): `/` serves Ana & Ben; the 3 demos stay at `/s/{slug}`.
- Demo replies stay publicly writable (fake data). Reseed weekly by hand; no cron, since it would put owner credentials in CI.
- Ships v0.4.0 (MINOR) when both units merge.

**Audit baseline (2026-10-05, `origin/main` @ 052e46c):** CI green; Sprint 3 RSVP form deployed. Live `/` `og:image`, `robots.txt` and `sitemap.xml` point at `http://localhost:3000`: `app/{page,robots,sitemap}` are prerendered, so `ROOT_DOMAIN` is read at build, where it's unset. `DEFAULT_SITE_SLUG` not set (`/` = landing, `/rsvp` 404). Prod `0002_rsvp` + `seed:rsvp` not verified. Only `v0.1.0` tagged; CHANGELOG has no `[0.2.0]`.

**Owner ops (no PR, before WW-22's screenshots)**
- [ ] Commit the v0.3.0 roll-up, backfill CHANGELOG `[0.2.0]`, tag `v0.2.0` at `7992af7` and `v0.3.0` on `main`.
- [ ] Apply `0002_rsvp` to Neon `prod` and `preview` (owner role, laptop, per runbook); run `ALLOW_DEMO_SEED=1 pnpm --filter @ww/db seed:rsvp` against prod. Verify by looking up "Maya Santos" on `/s/ana-and-ben/rsvp`.
- [ ] Set `DEFAULT_SITE_SLUG=ana-and-ben` in Vercel Production and redeploy.
- [ ] Weekly reseed reminder.

- [x] WW-21 — Fix localhost URLs in the homepage preview, robots.txt and sitemap · Fixed · files: apps/web/app/{page.tsx,robots.ts,sitemap.ts}, apps/web/src/lib/__tests__/ (new test) · depends: —
  · (merged 2026-10-06, PR #20) `export const dynamic = "force-dynamic"` on `app/page.tsx`, `robots.ts` and `sitemap.ts`, so `ROOT_DOMAIN` is read per request, not at build. The turbo build env is unchanged (WW-7's contract holds). New test `src/lib/__tests__/dynamic-routes.test.ts` guards the three exports.
    - ⚠️ Verify on prod after the deploy: `og:image`, `/robots.txt` and `/sitemap.xml` should show the `*.vercel.app` host, not `localhost:3000`.
- [ ] WW-22 — Make the RSVP demo usable for visitors and refresh the README · Changed · files: apps/web/src/content/placeholder.ts, apps/web/app/sites/[siteKey]/rsvp/page.tsx, README.md, docs/screenshots/rsvp.png (new), docs/screenshots/* (if changed) · depends: WW-21, owner ops (migration, seed, `DEFAULT_SITE_SLUG`)

## Sprint 3 — Single-couple default view + RSVP demo   (planned 2026-10-05) · v0.3.0
Epic: WW-14

**Locked decisions** (approved 2026-10-05 — do not re-litigate)
- White-labeling is hidden, not removed: new optional `DEFAULT_SITE_SLUG` makes `/` and the site pages on the platform host serve one couple's site (`ana-and-ben`). `/s/{slug}`, subdomains and custom domains keep working. Landing page + `SHOWCASE_MODE` code stay, switched off when a default is set. (Not `SINGLE_TENANT_SLUG`, which would also kill `/s/…`.)
- RSVP is DB-backed with seeded **fake** guests (no real PII on the free-tier prod DB), all under RLS. A reseed command makes the video repeatable.
- Lookup is exact-name match, returns no list. Rate limiting, invite codes, confirmation email and admin stay in the later Guest/RSVP sprint.
- Migration follows the runbook: owner role applied locally, `MIGRATE_DATABASE_URL` never in Vercel. Grant-matrix test must change with the migration.
- Ships v0.3.0 (MINOR) when all 5 units merge. Branch base is `develop`.

- [x] WW-15 — Default-site mode (hide white-label) · Changed · files: apps/web/src/lib/{resolve-host,tenant-context}.ts, apps/web/src/lib/__tests__/resolve-host.test.ts, apps/web/middleware.ts, apps/web/app/{page,sitemap}.tsx, apps/web/.env.example, infra/README.md, docs/runbook.md · depends: —
  · (merged 2026-10-05, PR #14) `DEFAULT_SITE_SLUG` env → `TenantConfig.defaultSiteSlug`; on the platform host `decideRoute` rewrites everything except `/s/…` and `/sites/…` to `s.{slug}`, `siteBasePath` returns `""` for the default site, `SHOWCASE_MODE` banner is forced off, sitemap lists the site's pages. `SINGLE_TENANT_SLUG` still wins. Downstream (WW-19): `/rsvp` on the platform host now serves `app/sites/[siteKey]/rsvp` under key `s.{default}`.
- [x] WW-16 — RSVP schema, RLS and grants · Added · files: packages/db/src/schema/{invitations,guests,rsvp,index}.ts, packages/db/drizzle/0002_rsvp.sql (+ meta), packages/db/src/__tests__/tenant-isolation.test.ts, packages/db/README.md · depends: — · ⚠️ high-stakes (migration) → code-guardian
  · (merged 2026-10-05, PR #15) Migration `0002_rsvp` adds `invitations`, `guests` and `rsvp_responses` (one reply per invitation; per-guest answers in `guests` jsonb), all with ENABLE + FORCE RLS. A composite `(site_id, invitation_id)` FK keeps guests and replies in their own site.
    - **What `ww_app` can do:** SELECT invitations/guests. On replies: INSERT, UPDATE on payload columns only, SELECT `(invitation_id)` only.
    - **DB constraints:** reply emails must be on reserved domains (`example.com|net|org`, `*.test|.example|.invalid`); `guests` jsonb holds 1–20 entries, ≤16 KB.
    - **Gate:** code-guardian APPROVE after 3 Blockers fixed (no cross-tenant read test on replies, live-leg owner writes, PII retention). 0002 was amended in place: it had been applied only to Neon dev, which was rolled back and re-migrated. Live dev 64/64 with `ALLOW_TEST_FIXTURES=1`; without it the live leg writes nothing.
    - **WW-17 (seed):**
      - Reset by deleting the demo parties; the cascade removes guests and replies.
      - The README commits to a reseed before each demo and at least weekly on prod.
      - Party/guest IDs `1a7e…`/`9e57…` with suffixes `a1`/`b1` are reserved for test fixtures.
      - The seed counts for RSVP tables aren't asserted by the isolation suite.
    - **WW-18 (actions):**
      - Writes take no `RETURNING`. Upsert with `onConflictDoUpdate({ target: invitationId, set: <bound values> })`, never `excluded.*`, and always set `updatedAt`.
      - Use `lower(full_name)` for the lookup (indexed per site).
      - Zod must validate each jsonb entry and that every `guestId` belongs to the invitation; the DB checks only size and shape.
      - Use example.com emails in tests, and map CHECK `23514` to a user message.
    - **WW-19:** hint visitors to use `you@example.com`.
    - ⚠️ **Prod:** `0002_rsvp` is on Neon dev only. Apply it to `production` (and `preview`) via the runbook before WW-18/19 deploy.
    - **Open nits (non-blocking):**
      - No test for `rsvp_responses_guests_shape`.
      - The README doesn't say an email local part can still carry a real address.
      - The Neon setup leaks its pools if the fixture insert throws.
      - Concurrent opted-in live runs on dev collide.
- [x] WW-17 — Seed fake invitations and reset · Added · files: packages/db/src/seed.ts (or seed-rsvp.ts), packages/db/package.json, packages/db/README.md · depends: WW-16
  · (merged 2026-10-05, PR #16) `pnpm --filter @ww/db seed:rsvp` (needs `ALLOW_DEMO_SEED=1`, refuses `NODE_ENV=production`) deletes and recreates 8 fake `ana-and-ben` parties; replies cascade away. Idempotent, other sites and test fixtures untouched.
    - Downstream (WW-19): lookup names are exact-match, e.g. "Maya Santos", "Jun Tanaka"; "Guest of Jun Tanaka" is the plus-one. Party IDs `1a7e0000-…0100`–`0107`, guest IDs `9e570000-…`.
    - Downstream (WW-18): `seedRsvp` / `DEMO_RSVP_PARTY_IDS` are exported from `packages/db/src/seed-rsvp.ts` for tests that need real parties.
    - Test file `src/__tests__/seed-rsvp.test.ts` was added outside the listed files (acceptance required a test).
- [x] WW-18 — RSVP server actions · Added · files: apps/web/src/lib/rsvp/{actions,schema}.ts, apps/web/src/lib/rsvp/__tests__/* · depends: WW-16 · ⚠️ guest PII → code-guardian
  · (merged 2026-10-05, PR #17) `lookupInvitation(name)` and `submitRsvp(payload)` server actions. The site comes from the `x-ww-site` header and all DB work runs in `withSite`. Submit upserts one row per invitation with no `RETURNING` and requires the reply to cover exactly the party's guests.
    - **API (for WW-19):** `lookupInvitation` returns `RsvpLookupResult | null` and plugs straight into `RsvpForm.onLookup`. A name in two parties also returns null. A DB failure throws a generic error, so the form shows its fallback.
    - **WW-19 needs a client adapter:** `submitRsvp` returns `{ ok: true } | { ok: false; error }` (Next redacts thrown messages in prod). `onSubmit` expects a throw, so wrap it: on `ok: false`, `throw { userMessage: error }`. That needs a small client component, which isn't in WW-19's file list.
    - **Validation:** strict Zod with caps matching the DB CHECKs. Emails must use reserved domains (hint: `you@example.com`). Option ids are slug-shaped; they aren't checked against the real meal/event lists yet (no content model).
    - **Gate:** CI + code-guardian APPROVE with nits, no Blockers. Its 3 should-fix items were fixed in the PR (site lookup inside the error boundary, a real `updated_at` test, tests for the 23514/23503 mappings). 35 tests run on PGlite with the real migrations as `ww_app`; the isolation tests were mutation-checked.
    - Scope: `apps/web/package.json` and `pnpm-lock.yaml` gained `@electric-sql/pglite` (devDep, approved).
    - ⚠️ **Before real PII (Guest/RSVP sprint):** one exact name reveals the whole party, enough to overwrite its reply. The fixed seed IDs also let anyone overwrite a demo reply without a lookup. No rate limit or invite code yet; this was accepted for fake data under the locked decisions.
- [x] WW-19 — Wire the RSVP page and demo script · Added · files: apps/web/app/sites/[siteKey]/rsvp/page.tsx, apps/web/src/content/placeholder.ts, docs/demo-script.md · depends: WW-15, WW-17, WW-18
  · (merged 2026-10-05, PR #18) `/rsvp` now runs the real flow: lookup and submit server actions behind a client adapter, meals/events from `placeholder.ts` (`rsvpMeals`, `rsvpEvents`), `replyBy` "August 1, 2027" so the form is open. `docs/demo-script.md` has the names, click path, SQL check and reseed.
    - Scope: added `apps/web/src/components/rsvp-demo-form.tsx` (the `{ ok: false }` → throw adapter), outside the listed files, approved.
    - ⚠️ Preview/prod need `0002_rsvp` applied and `seed:rsvp` run before the flow works there.

## Sprint 2 — Portfolio showcase readiness   (planned 2026-10-04)
Epic: WW-9

**Locked decisions** (approved 2026-10-04 — do not re-litigate)
- Portfolio showcase, free tiers only: Vercel Hobby + Neon free. `ROOT_DOMAIN` = the project's
  production `*.vercel.app` alias; no domain purchase. Demos are served by path (`/s/{slug}`);
  live subdomain routing is a later DNS + env change, no code.
- Production Neon branch `prod` holds the demo seed only, until a real client exists. Seed runs
  locally (`ALLOW_DEMO_SEED=1`); `MIGRATE_DATABASE_URL` is still never set in Vercel.
- No schema changes this sprint. Per-site content stays on `content/placeholder.ts` (content model
  is Sprint 3). No guest PII; RSVP stays closed.
- License: MIT.
- Ships v0.2.0 (MINOR) when all 4 units merge.

**Audit baseline (2026-10-04, `main` @ a59360c):** lint/typecheck/156 tests green (incl. 40 live
Neon isolation tests); `next build` clean; local prod smoke against Neon `dev`: all 3 demo sites ×
4 pages = 200, subdomain + custom-domain hosts resolve, 404s correct. Gaps: not deployed (Vercel CLI
not logged in; `wedding-website.vercel.app` is someone else's project), apex `/` 404s, demo sites
look identical, no favicon/OG/robots/sitemap, README stale, `apps/web/.gitignore` (`.vercel`) untracked.

- [x] WW-10 — Production deploy on Vercel + Neon · Added · files: apps/web/.gitignore, infra/README.md, docs/runbook.md, TASKS.md (close WW-8 open tasks) · depends: — · ⚠️ high-stakes (prod credentials / DB role) → code-guardian
  - Neon `prod` branch: migrations + demo seed + `ww_app_login` (password set in Console, not SQL — `28P01`). Vercel Production env: `DATABASE_URL` (app role, pooled), `ROOT_DOMAIN` = prod alias. Preview stays pinned `SINGLE_TENANT_SLUG=ana-and-ben` on `preview`. Runbook gate: prod `DATABASE_URL` absent from Preview; `MIGRATE_DATABASE_URL` absent everywhere.
· (merged 2026-10-04)
- [x] WW-11 — Platform landing page at `/` + site metadata · Added · files: apps/web/app/page.tsx (new), apps/web/app/layout.tsx, apps/web/app/{icon.svg,opengraph-image.*,robots.ts,sitemap.ts} (new), apps/web/middleware.ts, apps/web/src/lib/__tests__/resolve-host.test.ts · depends: —
  - ⚠️ Middleware matcher only excludes `favicon.ico|robots.txt|sitemap.xml`; new icon/OG routes would be rewritten into tenant routes and 404 on tenant hosts. Extend the matcher + tests. `decideRoute` already returns `pass` for platform-host `/`.
· (merged 2026-10-04)
- [x] WW-12 — Demo tenant polish · Changed · files: packages/ui/src/tokens.css, packages/ui/src/styles/design.css, packages/ui/src/__tests__/token-contract.test.ts, apps/web/src/components/site-chrome.tsx, apps/web/src/lib/tenant-context.ts, apps/web/.env.example, apps/web/src/content/placeholder.ts · depends: —
  - Re-tune `classic`/`garden`/`modern` (CSS only, no seed/DB change) so the 3 demos are distinct; AA contrast for inverse eyebrow; `SHOWCASE_MODE=1` demo banner linking to `/`; sample `bookingUrl`; nav ≤2 rows at 390px. Clears WW-3's follow-ups.
· (merged 2026-10-04)
- [x] WW-13 — Portfolio README + repo presentation · Changed · files: README.md, LICENSE (new, MIT), docs/screenshots/* (new) · depends: WW-10, WW-11, WW-12
  - Live link, screenshots, Mermaid architecture, key decisions, all 5 packages, local setup. Hand the owner the `gh repo edit` command (homepage + topics); don't run it.
· (merged 2026-10-05)

## Sprint 1 — Whitelabel wedding site skeleton on Vercel   (planned 2026-09-28)
Epic: WW-?E

**Locked decisions** (inherited context — do not re-litigate)
- Multi-tenant shared schema: `site_id` on every tenant-owned table + Postgres RLS.
- Single-tenant reuse is a runtime mode (`SINGLE_TENANT_SLUG` env pin), never a fork.
- Drizzle + drizzle-kit over Prisma. Neon serverless driver: HTTP for reads, pooled for txns.
- One Next.js 15 app (`apps/web`) with route groups `(site)` / `(admin)`. Not two apps.
- Tailwind v4 + CSS-variable tokens. `packages/ui` is the landing zone for the Claude Design
  import, which happens AFTER Sprint 1 — hence no real pages in this sprint.
- Hosting: Vercel `sin1` + Neon `aws-ap-southeast-1`. GCP dropped (cost + native ISR).
  Privacy frame is PH DPA 2012 / NPC, relevant from Sprint 3 onward.
- No payments or money flow in any sprint. Registry = outbound links only.
- Ships v0.1.0 (MINOR) when all 5 units merge.

**Open risks**
- Neon owner role bypasses RLS → app must connect as a non-owner role + `FORCE ROW LEVEL SECURITY`.
- No DB/IO in Next middleware → middleware parses host only, sets `x-ww-site`; DB resolve in layout.
- Guest PII / dietary data (Sprint 3) → data minimization + documented retention, no 3rd-party
  analytics on guest pages.
- Sprint 5 media storage undecided: Vercel Blob (preferred) vs GCS.

- [x] WW-4 — Monorepo, tooling and CI baseline · Added · files: package.json, pnpm-lock.yaml, eslint.config.mjs, pnpm-workspace.yaml, turbo.json, .npmrc, .nvmrc, .editorconfig, .gitignore, README.md, TASKS.md, packages/config/**, packages/env/** , .github/workflows/ci.yml · depends: — · (merged 2026-09-28) pnpm+Turbo monorepo, @ww/config (tsconfig/eslint/prettier), @ww/env createEnv, CI on Node 22. Downstream: extend `baseEnvSchema` via `createEnv` for DATABASE_URL etc.; extend `@ww/config/tsconfig/base.json`; re-export `@ww/config/eslint`; TS pinned ~6.0.3 (typescript-eslint <6.1).
- [x] WW-5 — packages/db: Drizzle + Neon tenancy core, RLS and demo seed · Added · files: packages/db/** (drizzle.config.ts, src/client.ts, src/tenant.ts, src/seed.ts, src/schema/{sites,domains,theme,users,members}.ts, drizzle/{0000_init,0001_rls}.sql, src/__tests__/tenant-isolation.test.ts), turbo.json · depends: WW-4 · ⚠️ high-stakes (migrations) → code-guardian · (merged 2026-09-29, PR #3) `@ww/db` with 5 tables, `ww_app` non-owner role + ENABLE/FORCE RLS on all, `withSite()`, SECURITY DEFINER host/slug resolvers, 3-site demo seed. Isolation suite runs on PGlite in CI and live on Neon `dev` (40/40); code-guardian APPROVE after 1 Blocker fixed (nested withSite switched tenant). Also added: src/{env,index}.ts, src/schema/index.ts, vitest.config.ts, README.md, .env.example; pnpm-lock.yaml.
  - **Tables/columns** (all `site_id`-scoped under RLS):
    `sites(id uuid pk, slug text unique [a-z0-9-], name, created_at, updated_at)` ·
    `site_domains(id uuid pk, site_id fk, hostname text unique lowercase, is_primary bool — ≤1 per site, created_at)` ·
    `site_theme(site_id uuid pk/fk, preset text default 'default', tokens jsonb Record<string,string> default {}, updated_at)` ·
    `users(id uuid pk, email text unique lowercase, name, created_at)` — visible only via membership in the current site ·
    `site_members(site_id fk, user_id fk, role enum site_member_role('owner','editor'), created_at; pk(site_id,user_id))`.
    Drizzle exports: `sites`, `siteDomains`, `siteTheme`, `users`, `siteMembers`, `siteMemberRole`.
  - **API (for WW-7):** `withSite<T>(db: Database, siteId: string, fn: (tx: SiteTx) => Promise<T>): Promise<T>` needs `getPoolDb()` (Node runtime only, not Edge). Sets txn-local `app.site_id`; throws `TypeError` on a non-UUID and throws if nested with a different site. `resolveSiteByHost(db, hostname)` / `resolveSiteBySlug(db, slug)` → `{ id, slug } | null`, no context needed (use `getHttpDb()`); they lowercase but do NOT strip port/trailing dot, so WW-7 normalizes. Types: `Database`, `SiteTx`, `ResolvedSite`. Env: `DATABASE_URL` (app role, pooled) via `dbEnvSchema`; `MIGRATE_DATABASE_URL` (owner, migrations/seed only).
  - **Privileges:** `ww_app` = SELECT on all 5 tables, UPDATE `sites`, INSERT/UPDATE/DELETE `site_theme`. Routing/membership/identity writes are Sprint 4's job, which must add grants and cross-tenant write tests for them. The test asserts the exact matrix, so any new grant must update it.
  - **Ops:** the Neon login role is created in SQL, but its password must be set in the Console (a SQL-set password gets `28P01` at Neon's proxy). The seed needs `ALLOW_DEMO_SEED=1`. Never edit an applied migration; drizzle-kit can't see RLS/grants, so generated migrations must re-add them. Seed theme presets (`classic`/`garden`/`modern`) and empty `tokens` are placeholders until WW-6 fixes the token contract.
  - ⚠️ Found: `.gitignore` anchors `/node_modules` to root, so `packages/*/node_modules` gets committed. Needs a hotfix (not in WW-5 scope).
- [x] WW-6 — packages/ui: theming seam and design-system token contract · Added · files: packages/ui/** (README.md, src/tokens.css, src/styles/preset.css, src/theme-provider.tsx, src/primitives/{button,card,input}.tsx) · depends: WW-4 · (merged 2026-09-29, PR #4) `@ww/ui` with a Tailwind v4 preset (`@theme inline` → live `--ww-*` vars, `dark:` variant for system + forced modes), a layered token CSS (light + dark), a server-only `ThemeProvider` that hoists sanitized per-site overrides into the SSR `<head>` (no FOUC, no client JS), and disposable `Button`/`Card`/`Input`. Gate: CI only. Also added: src/{index,token-contract,cx}.ts, src/__tests__/{token-contract,theme-provider}.test.*, package.json, tsconfig.json, eslint.config.js; pnpm-lock.yaml. 38 tests, including a real Tailwind compile and SSR render.
  - **Token contract (what the Claude Design import must satisfy)**: 17 CSS vars `--ww-<name>`, canonical list `TOKEN_NAMES` in `packages/ui/src/token-contract.ts`. Tests fail if `tokens.css`/`preset.css` drift from it.
    - **Surface** (flip light/dark): `color-background`, `color-foreground`, `color-surface`, `color-surface-foreground`, `color-muted`, `color-muted-foreground`, `color-border`, `color-input`.
    - **Brand** (same in both modes): `color-primary`, `color-primary-foreground`, `color-accent`, `color-accent-foreground`, `color-destructive`, `color-destructive-foreground`, `color-ring`, `font-body`, `font-heading`, `radius`.
    - Tailwind: `bg-/text-/border-<color-name minus "color-">`, `font-body`/`font-heading`, `rounded-sm/md/lg/xl` = radius ×0.5/1/1.5/2.
    - Presets (brand-only): `default`, `classic`, `garden`, `modern`. These match the WW-5 seed, and an unknown name falls back to `default`.
  - **`site_theme.tokens` format**: keys are token names without `--ww-`, and the `dark:` prefix sets the dark value. An unprefixed surface key is **light-only**. Unknown keys are dropped. Values must pass `isSafeTokenValue`: ≤200 chars, no `;{}<>\@!:`, no comments, balanced quotes/parens, and only color functions/`color-mix`/`var`/`calc`/`min`/`max`/`clamp` (no `url()`). Sprint 4's theme editor should validate with the same function before writing.
  - **API (for WW-7):** `<ThemeProvider preset? tokens? mode?="system"|"light"|"dark">`, one per page around site content. The app needs `transpilePackages: ["@ww/ui"]` (TS source, no build) and `globals.css`: `@import "tailwindcss"; @import "@ww/ui/preset.css";`. Exports: `ThemeProvider`, `buildThemeCss`, `isSafeTokenValue`, `TOKEN_NAMES`, `SURFACE_TOKENS`, `BRAND_TOKENS`, `PRESETS`, `Button`, `Card`, `Input`. Peers: react ^19, tailwindcss ^4.1.
  - ⚠️ For WW-7: the planned path `app/_sites/[siteSlug]/…` is an App Router **private folder**, so it's excluded from routing and middleware rewrites to it would 404. Rename it (e.g. `app/sites/[siteSlug]` or a route group) when WW-7 starts.
  - ⚠️ PR #5 (also from branch WW-6) merged only `packages/db/node_modules/**` churn. That's the same `.gitignore` bug noted under WW-5, so the hotfix is getting more urgent.
- [x] WW-7 — apps/web: Next.js app, tenant resolution and themed public shell · Added · files: apps/web/** (next.config.ts, middleware.ts, .env.example, app/layout.tsx, app/_sites/[siteSlug]/{layout,page,not-found}.tsx, app/api/health/route.ts, src/lib/{resolve-host,site,tenant-context}.ts, src/lib/__tests__/resolve-host.test.ts) · depends: WW-5, WW-6 · (merged 2026-09-29, PR #6) `@ww/web` is a Next 15 app with Tailwind v4 and the `@ww/ui` preset. Edge middleware does no DB/IO: it maps host + path to a site key and rewrites to `/sites/[siteKey]`. The site layout resolves that key through `@ww/db` (custom domain first, then subdomain slug), loads site + theme under `withSite`, and caches it (`unstable_cache` tag `ww-site`, ISR 300s). `/api/health` is liveness only. 64 host-parser/precedence tests. Ledger entry written retroactively by WW-8 (Step 5 was skipped at merge).
  - **Routing:** precedence is `SINGLE_TENANT_SLUG` pin → custom domain → `{slug}.ROOT_DOMAIN` → `/s/{slug}` on the platform host (apex, `www.`, IPs). Site keys are `s.{slug}` / `h.{hostname}`. Direct hits on `/sites/…` or a bad `/s/…` 404. The private-folder issue is fixed: the route is `app/sites/[siteKey]` (not `app/_sites/[siteSlug]`). There is also a catch-all `[...path]` 404 and a root `app/not-found.tsx`. There's no `app/page.tsx` yet, so the platform apex `/` 404s.
  - **Env (runtime only, nothing read at build):** `DATABASE_URL` (app role, pooled; Node runtime), `ROOT_DOMAIN` (bare hostname, default `localhost`), `SINGLE_TENANT_SLUG` (optional, validated slug). `apps/web/.env.example`.
  - ⚠️ Vercel preview hosts (`*.vercel.app`) aren't platform hosts, so they resolve as a custom domain and 404 unless the deploy is pinned with `SINGLE_TENANT_SLUG`. Handled in WW-8.
- [x] WW-8 — Vercel delivery pipeline: preview deploys, Neon branching, wildcard domains, runbook · Added · files: apps/web/vercel.json (was `vercel.json`: Vercel reads it from the project Root Directory), apps/web/next.config.ts, turbo.json, .github/workflows/ci.yml, infra/README.md, docs/runbook.md · depends: WW-7
  - **Decisions (approved 2026-09-29):** previews use one shared Neon `preview` branch (child of `dev`, demo seed only, `ww_app_login`). No per-PR branches for now; the upgrade path is documented. The Neon↔Vercel integration is rejected: it injects the owner role (bypasses RLS) and branches from prod data. Preview is pinned with `SINGLE_TENANT_SLUG=ana-and-ben`. `ROOT_DOMAIN` is a placeholder until a domain is bought. `MIGRATE_DATABASE_URL` is never set in any Vercel environment.
  - **Tasks:** [x] apps/web/vercel.json (sin1, turbo build) · [x] next.config.ts cache headers · [x] turbo.json: no change needed (remote cache is env-driven; default strict env mode already keeps `DATABASE_URL` out of `next build`) · [x] ci.yml build step + OIDC remote cache · [x] infra/README.md (env matrix, Vercel/Neon setup) · [x] docs/runbook.md (deploy, rollback, migrations, domains, preview-DB check) · [ ] one-time setup (Neon `preview` branch, Vercel project + env, domains, `TURBO_TEAM`): owner, per infra/README.md · [ ] gate: prod `DATABASE_URL` absent from Preview (inspection, runbook check)

## Design system import
- [x] WW-3 — Claude Design import: Arc & Hearth tokens, components and public site pages · Added · files: packages/ui/** (src/tokens.css, src/styles/{preset,design}.css, src/components/{core,arcs,forms,rsvp}/**, src/index.ts, README.md, src/__tests__/{components.test.tsx,token-contract.test.ts,theme-provider.test.tsx}; src/primitives/ removed), apps/web/next.config.ts, apps/web/app/layout.tsx, apps/web/app/sites/[siteKey]/{layout,page}.tsx + {schedule,travel,rsvp}/page.tsx, apps/web/src/{components/site-chrome.tsx,content/placeholder.ts}, apps/web/src/lib/{resolve-host,site}.ts, apps/web/src/lib/__tests__/resolve-host.test.ts · depends: WW-6, WW-7 · (merged 2026-10-02 into `develop`, PR #8; CI green) Ships with Sprint 1 in v0.1.0.
  - **Source:** claude.ai/design project `5209fe00-…` (`ui_kits/wedding-site/index.html` + the components and tokens it loads). `production/` (RSVP API/schema/email) is NOT imported: no `site_id`/RLS, GCP-targeted, and guest PII belongs to Sprint 3.
  - **Decisions (approved 2026-10-01):** (1) Option A: map onto the 17 `--ww-*` tokens and add a fixed design layer (earth palette, arch/dome radii, shadows, type scale) that isn't overridable per site; primary-derived tints use `color-mix` so per-site primary colours carry through. (2) Server-rendered Tailwind components; only the RSVP form ships JS (the Accordion uses native exclusive `<details name>`). (3) RSVP is UI only: with no `onLookup` handler the form renders closed (disabled, "replies open soon"), and nothing is collected or sent. (4) `site.name` drives the wordmark, and the rest is a labelled placeholder file until Sprint 2. (5) Light only: the site layout forces `mode="light"`, and the dark token values are left untouched. Fonts are self-hosted through `next/font` (no Google requests on guest pages).
  - **Tasks:** [x] tokens.css values + design.css layer + preset wiring · [x] packages/ui components (core, arcs, forms, rsvp) replacing the disposable primitives · [x] `siteBasePath` + tests (links work under `/s/{slug}` and on domains) · [x] site chrome + Home/Schedule/Travel/RSVP routes · [x] next/font in the root layout · [x] tests/lint/typecheck/build green (ui 46, web 70; local smoke against Neon `dev`) · [x] ledger closeout at merge
  - **Found while building:** (a) The `@ww/ui` barrel made every page ship the RSVP form's JS (113 kB first load). Fixed with `experimental.optimizePackageImports: ["@ww/ui"]`: the form (6.6 kB) now loads only on `/rsvp`, and the other pages are 106 kB. (b) The design's linen `accent-foreground` would sit on the presets' light accents, so each preset now pins the old dark accent foreground, and inverse `SectionHeading` titles inherit the ground's colour.
  - ⚠️ **Follow-ups:** all three seeded demo sites use a placeholder preset (`classic`/`garden`/`modern`), so none shows the default Arc & Hearth palette. The presets should be re-tuned as earth-tone variants, or a demo site should seed `default`. The inverse eyebrow (`clay-light`) is faint on the presets' light accents. The hotels have no `bookingUrl` in the sample, so the "Book a room" link is hidden. Sprint 2 replaces `content/placeholder.ts`.

## Hotfixes
- [x] WW-hotfix — Untrack committed `packages/*/node_modules` · Fixed · files: packages/{config,db,env}/node_modules/** (47 files removed from the index) · depends: — · (committed 2026-10-02 straight to `develop`, ships in v0.1.0) `.gitignore` was already fixed in 3430de4 (unanchored `node_modules`), but files that were already tracked stayed tracked. Caused the junk-only PR #5. No Jira key yet.

## Backlog — future sprints (not planned in detail)
> Renumbered 2026-10-04 when Sprint 2 became the portfolio showcase. "Sprint 2/3/4/5" in the
> Sprint 1 and WW-3 entries above refer to what is now Sprint 3/4/5/6.
> Renumbered again 2026-10-06: Sprint 3 became the RSVP demo and Sprint 4 the launch polish, so
> the content model moved to Sprint 5 and everything after it shifted by two.
- Sprint 5 — Content model + public pages (story, schedule, venue/travel, FAQ, registry links) on the imported design system.
- Sprint 6 — Guest + RSVP: invite codes, party-level RSVP, meals/dietary, plus-ones, confirmation email, rate limiting. Carries the guest-PII constraints.
- Sprint 7 — Admin: Auth.js v5, membership-scoped authorization, site/theme editing, guest list CRUD + CSV import, RSVP export. ⚠️ high-stakes (auth).
- Sprint 8 — Media: signed uploads + gallery (storage vendor TBD).

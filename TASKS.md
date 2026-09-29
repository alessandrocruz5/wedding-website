# Wedding Website — Sprints
Status: [ ] planned · [~] in progress · [x] merged · [-] cancelled (excluded from changelog)

> Keys below are placeholders (`WW-?n`). Replace each with the real Jira key once the Epic
> and its children exist in project **WW**.

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
- [ ] WW-6 — packages/ui: theming seam and design-system token contract · Added · files: packages/ui/** (README.md, src/tokens.css, src/styles/preset.css, src/theme-provider.tsx, src/primitives/{button,card,input}.tsx) · depends: WW-4
- [ ] WW-7 — apps/web: Next.js app, tenant resolution and themed public shell · Added · files: apps/web/** (next.config.ts, middleware.ts, .env.example, app/layout.tsx, app/_sites/[siteSlug]/{layout,page,not-found}.tsx, app/api/health/route.ts, src/lib/{resolve-host,site,tenant-context}.ts, src/lib/__tests__/resolve-host.test.ts) · depends: WW-5, WW-6
- [ ] WW-8 — Vercel delivery pipeline: preview deploys, Neon branching, wildcard domains, runbook · Added · files: vercel.json, apps/web/next.config.ts, turbo.json, .github/workflows/ci.yml, infra/README.md, docs/runbook.md · depends: WW-7

## Hotfixes
_none yet_

## Backlog — future sprints (not planned in detail)
- Sprint 2 — Content model + public pages (story, schedule, venue/travel, FAQ, registry links) on the imported design system.
- Sprint 3 — Guest + RSVP: invite codes, party-level RSVP, meals/dietary, plus-ones, confirmation email, rate limiting. Carries the guest-PII constraints.
- Sprint 4 — Admin: Auth.js v5, membership-scoped authorization, site/theme editing, guest list CRUD + CSV import, RSVP export. ⚠️ high-stakes (auth).
- Sprint 5 — Media: signed uploads + gallery (storage vendor TBD).

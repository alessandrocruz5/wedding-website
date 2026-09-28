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

- [ ] WW-4 — Monorepo, tooling and CI baseline · Added · files: package.json, pnpm-lock.yaml, eslint.config.mjs, pnpm-workspace.yaml, turbo.json, .npmrc, .nvmrc, .editorconfig, .gitignore, README.md, TASKS.md, packages/config/**, packages/env/** , .github/workflows/ci.yml · depends: —
- [ ] WW-5 — packages/db: Drizzle + Neon tenancy core, RLS and demo seed · Added · files: packages/db/** (drizzle.config.ts, src/client.ts, src/tenant.ts, src/seed.ts, src/schema/{sites,domains,theme,users,members}.ts, drizzle/{0000_init,0001_rls}.sql, src/__tests__/tenant-isolation.test.ts), turbo.json · depends: WW-4 · ⚠️ high-stakes (migrations) → code-guardian
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

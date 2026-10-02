# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Unit details live in `TASKS.md`.

## [Unreleased]

## [0.1.0] - 2026-10-02

Sprint 1: whitelabel wedding site skeleton, plus the Claude Design import.

### Added
- **WW-4:** pnpm + Turborepo monorepo, shared `@ww/config` (tsconfig/eslint/prettier),
  `@ww/env` schema validation, and GitHub Actions CI on Node 22.
- **WW-5:** `@ww/db`, the Drizzle + Neon tenancy core. Five `site_id`-scoped tables under
  `FORCE ROW LEVEL SECURITY`, a non-owner `ww_app` role, `withSite()`, host/slug resolvers,
  a demo seed, and a tenant-isolation test suite.
- **WW-6:** `@ww/ui` theming seam, with a 17-token `--ww-*` contract, a Tailwind v4 preset,
  and a server-only `ThemeProvider` that applies sanitized per-site overrides without FOUC.
- **WW-7:** `@ww/web`, a Next.js 15 app with Edge host-to-site routing (custom domain →
  subdomain → `/s/{slug}`, plus the `SINGLE_TENANT_SLUG` pin), a cached site layout and
  `/api/health`.
- **WW-8:** Vercel delivery pipeline (`sin1`, preview deploys pinned to a shared Neon `preview`
  branch), cache headers, CI build with OIDC remote cache, `infra/README.md` and `docs/runbook.md`.
- **WW-3:** Arc & Hearth design system: token values, a fixed design layer, server-rendered
  components (core, arcs, forms, RSVP), and public Home/Schedule/Travel/RSVP pages on
  placeholder content. The RSVP form is UI only and renders closed. Fonts are self-hosted.

### Fixed
- Committed `packages/*/node_modules` removed from the repository.

### Known gaps
- Not deployed. The Vercel/Neon one-time setup (WW-8) is outstanding, and `ROOT_DOMAIN` is a
  placeholder until a domain is bought.
- The platform apex `/` has no page and returns 404.
- All demo sites seed a placeholder preset, so none shows the default Arc & Hearth palette.
- Page content is placeholder until Sprint 2. RSVP collects nothing until Sprint 3.

[Unreleased]: https://github.com/alessandrocruz5/wedding-website/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alessandrocruz5/wedding-website/releases/tag/v0.1.0

# Runbook

Operational procedures. For the topology, env matrix and the reasoning behind it, see
[infra/README.md](../infra/README.md). CLI commands assume `cd apps/web` with the project linked
(`vercel link`).

## Deploy

1. Push a branch or open a PR. CI runs (format, lint, typecheck, test, build), and Vercel builds a
   **Preview** against the Neon `preview` branch, pinned to the demo site `ana-and-ben`.
2. Check the preview URL Vercel posts on the PR. It needs a Vercel login (Deployment Protection).
3. Merge to `main`. Vercel builds and promotes **Production**.
4. Smoke-test production: `curl -s https://<ROOT_DOMAIN>/api/health` → `{"status":"ok"}`, then load
   one site via its subdomain and one via `/s/{slug}`.

If the PR has a migration, run [Migrations](#migrations) **before** step 3.

## Pre-merge check: Preview must not use the production database

Run this after any change to Vercel env vars, and before merging WW-8. A preview writing to
production corrupts real data without any error.

```sh
cd apps/web
vercel env ls
```

`DATABASE_URL` must appear as **two separate rows**: one targeting only Production, one targeting
only Preview. A single row listing both is the failure. There must also be no `MIGRATE_DATABASE_URL`
row at all.

Then compare the endpoints. The pulled files contain credentials, so keep them in a temp dir and
delete them:

```sh
d=$(mktemp -d)
vercel env pull "$d/prod" --environment=production --yes >/dev/null
vercel env pull "$d/preview" --environment=preview --yes >/dev/null
grep -h '^DATABASE_URL=' "$d/prod" "$d/preview" | grep -o 'ep-[a-z0-9-]*' | sed 's/-pooler$//'
grep -h '^DATABASE_URL=' "$d/prod" "$d/preview" | grep -o '//[^:]*' # role: both must be ww_app_login
rm -rf "$d"
```

Pass criteria:

- The two endpoints differ.
- The Preview endpoint equals `<ep-preview>` in the infra README.
- Both roles are `ww_app_login`.
- `SINGLE_TENANT_SLUG` is set in Preview and unset in Production.

If `vercel env pull` returns an empty `DATABASE_URL`, it was stored as Sensitive. Recreate it as
a regular encrypted variable.

Also check for branch-specific overrides: Preview variables can be scoped to one Git branch. In
the dashboard, filter Preview by branch. Any `DATABASE_URL` override there must also point at the
`preview` endpoint.

## Migrations

Migrations run from a laptop as the **owner** role (`MIGRATE_DATABASE_URL`, direct host, not
`-pooler`). The app never runs them, and Vercel never has the owner URL.

1. Write them **expand/contract**. Production runs the old code against the new schema until the
   deploy finishes, and a rollback runs old code for longer. So add columns and tables first, and
   drop or rename only in a later release. Every new table needs RLS (`ENABLE` + `FORCE`), a
   policy and `ww_app` grants, which drizzle-kit can't generate. Never edit an applied migration.
2. Apply in order, pointing `packages/db/.env`'s `MIGRATE_DATABASE_URL` at each branch in turn:
   ```sh
   pnpm --filter @ww/db db:migrate   # dev → preview → main
   ```
3. `preview` is shared, so a migration applied there affects every open PR's preview. Apply to
   `preview` only when the PR is ready. If a preview-only migration has to be undone, reset the
   branch (below) instead of hand-reverting it.
4. Apply to `main` just before merging.

## Reset the preview database

Neon Console → Branches → `preview` → **Reset from parent**. It returns to `dev`'s current
state. The endpoint and connection string stay the same, so Vercel needs no change. Use this
when previews have drifted or picked up junk data. It never touches `main`.

## Roll back

- **App:** Vercel dashboard → Deployments → the last good production deploy → **Instant
  Rollback**, or `vercel rollback <deployment-url>`. It takes effect immediately with no rebuild.
  It's only safe if the current schema still suits the old code, which is why migrations are
  expand/contract.
- **Schema:** fix forward with a new migration. Don't roll back by hand.
- **Data:** Neon point-in-time restore on `main` (Console → Restore). Restore into a new branch
  first to inspect it before touching `main`. The restore window depends on the Neon plan.

## Env var changes

Env changes only apply to **new** deployments. After editing a variable, redeploy: Deployments →
latest → **Redeploy**, or push a commit. For Production changes, redeploy production.

## Rotate the app database password

Each Neon branch has its own copy of `ww_app_login`, so rotate per branch.

1. Neon Console → the branch → Roles → `ww_app_login` → **Reset password**. Set it in the Console:
   a password set through SQL fails at Neon's proxy with `28P01`.
2. Update `DATABASE_URL` for the matching Vercel environment, then redeploy.
3. Run the [pre-merge check](#pre-merge-check-preview-must-not-use-the-production-database).

## Domains

- **Platform apex + wildcard:** Vercel → Project → Domains: add `<ROOT_DOMAIN>` and
  `*.<ROOT_DOMAIN>`. The wildcard certificate only issues once the domain's nameservers are
  Vercel's.
- **Client custom domain** (until Sprint 4 automates it):
  1. `vercel domains add <client-domain>` to add it to the project.
  2. The client adds DNS as Vercel instructs: CNAME to Vercel for a subdomain, A record for an
     apex.
  3. As the owner role, insert the `site_domains` row (lowercase hostname, `is_primary` as
     needed).
  4. It serves within the ISR window (≤5 min). An earlier 404 for that host may be cached until
     then.

## Incidents

- **Liveness:** `GET /api/health`. It doesn't touch the DB, so it stays up while Neon is down or
  asleep.
- **Logs:** `vercel logs <deployment-url>`, or the dashboard's Logs tab. Env validation failures
  fail fast with `Invalid environment variables:` and the offending keys.
- **Slow first request after idle:** Neon compute waking from scale-to-zero. Expected on the free
  plan.
- **Every page 404s on a preview:** `SINGLE_TENANT_SLUG` is missing from Preview, or the slug
  doesn't exist in the `preview` branch. Reseed, or reset it from `dev`.

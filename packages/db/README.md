# @ww/db

Drizzle schema, Neon clients and the tenancy core (`withSite()` + Postgres RLS).

## Tenancy model

- Every tenant-owned table carries `site_id`; RLS is `ENABLE` + `FORCE` on all of them.
- The app connects as a **non-owner login role** that is a member of `ww_app` (`NOBYPASSRLS`).
- Tenant context is the transaction-local GUC `app.site_id`, set only by `withSite()`.
  No context ⇒ 0 rows. It cannot outlive the transaction, so pooled connections are safe.
- Host/slug → site lookups use `SECURITY DEFINER` functions that expose only `id` + `slug`.

```ts
import { getHttpDb, getPoolDb, resolveSiteByHost, siteTheme, withSite } from "@ww/db";

const site = await resolveSiteByHost(getHttpDb(), host); // { id, slug } | null
const theme = await withSite(getPoolDb(), site.id, (tx) => tx.select().from(siteTheme));
```

`withSite()` needs a transaction-capable driver: use `getPoolDb()`, never `getHttpDb()`.

## Neon setup (once per project)

1. Create project in **aws-ap-southeast-1**; in the Neon Console add a **Neon** branch `dev`
   off the default branch (`production`/`main`). Not a git branch. Use `dev` for everything below.
2. Copy `.env.example` → `.env`; set `MIGRATE_DATABASE_URL` to the **owner**, direct host.
3. `pnpm --filter @ww/db db:migrate` — creates tables, the `ww_app` group role and policies.
4. Create the app login role **in SQL** (not the Console — Console roles join `neon_superuser`):
   ```sql
   CREATE ROLE ww_app_login LOGIN NOBYPASSRLS NOCREATEDB NOCREATEROLE IN ROLE ww_app;
   ```
   Then set its password in the **Console** (Branch → Roles → `ww_app_login` → Reset password).
   A password set via SQL (`PASSWORD '…'` / `ALTER ROLE`) is rejected by Neon's proxy (`28P01`).
   Set `DATABASE_URL` to this role on the **pooled** (`-pooler`) host.
5. `pnpm --filter @ww/db db:seed` (dev only; refuses `NODE_ENV=production`).
6. `pnpm --filter @ww/db test` — the isolation suite now also runs live against Neon and
   asserts the connection role is not superuser, cannot bypass RLS and owns no tables.

## Scripts

| Script        | Connection             | Purpose                                            |
| ------------- | ---------------------- | -------------------------------------------------- |
| `db:generate` | —                      | Diff schema → new SQL migration (never `push`)     |
| `db:migrate`  | `MIGRATE_DATABASE_URL` | Apply `drizzle/*.sql`                              |
| `db:seed`     | `MIGRATE_DATABASE_URL` | Idempotent 3-site demo data                        |
| `test`        | PGlite (+ Neon)        | Isolation suite; live leg runs when `DATABASE_URL` |

New tenant tables must add their grants + policies in a migration; the app role gets no default
privileges on purpose.

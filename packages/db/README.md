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
5. `ALLOW_DEMO_SEED=1 pnpm --filter @ww/db db:seed` (dev branch only; explicit opt-in, and it
   refuses `NODE_ENV=production`).
6. `pnpm --filter @ww/db test` — reads `.env`, so the isolation suite also runs live against Neon
   (otherwise that leg is reported as skipped). It asserts the connection role is not superuser,
   cannot bypass RLS, owns no tables and cannot `SET ROLE` into anything that can. Every write
   probe rolls back, so it is safe against a shared branch.

## Scripts

| Script        | Connection             | Purpose                                            |
| ------------- | ---------------------- | -------------------------------------------------- |
| `db:generate` | —                      | Diff schema → new SQL migration (never `push`)     |
| `db:migrate`  | `MIGRATE_DATABASE_URL` | Apply `drizzle/*.sql`                              |
| `db:seed`     | `MIGRATE_DATABASE_URL` | Idempotent 3-site demo data                        |
| `test`        | PGlite (+ Neon)        | Isolation suite; live leg runs when `DATABASE_URL` |

New tenant tables must add their grants + policies in a migration; the app role gets no default
privileges on purpose. Today `ww_app` may write only `site_theme`, update `sites` and submit RSVP
replies; routing, membership and identity writes arrive with the admin/auth layer (Sprint 4).

## RSVP (`invitations`, `guests`, `rsvp_responses`)

- `ww_app` may **read** parties and guests (for the exact-name lookup) and **insert/update**
  replies. It can read back only a reply's `id`, `site_id`, `invitation_id`: enough for
  `INSERT … ON CONFLICT (invitation_id) DO UPDATE` and `UPDATE … WHERE`. It can never read the
  email or free text. In the upsert, `SET` must use bound values, not `excluded.<col>`:
  reading `excluded` needs SELECT on that column and is refused.
- Guests and replies reference their invitation through a composite `(site_id, invitation_id)`
  FK. FK checks bypass RLS, so this is what stops a tenant from attaching rows to another
  tenant's invitation.
- One reply row per invitation. Per-guest answers live in its `guests` jsonb column. The app validates
  that each `guestId` belongs to the invitation; the database does not.

### Retention

Guest names, emails, dietary notes and messages are **personal data**.

- **Fake data only, for now.** The free-tier databases (including production) hold only seeded
  fictional guests. Real guest data must not be loaded until the Guest/RSVP sprint adds consent
  wording, rate limiting and an admin export/delete path.
- **No database backups to rely on for erasure.** Deleting a site cascades to its invitations,
  guests and replies; deleting an invitation cascades to its guests and reply. Neon's
  point-in-time restore window still holds deleted rows until it expires (it's short on the
  free tier), so honour erasure requests with a delete, never a restore.
- **Target once real data exists:** delete a site's RSVP data (invitations cascade) no later than
  **90 days after the wedding date**, and erase an individual's data on request within 30 days.
  This needs the wedding date on `sites` and a scheduled purge, both outside this package today.
- The demo reseed (WW-17) deletes and recreates demo parties, so dev/prod replies don't accumulate.

⚠️ drizzle-kit does not see RLS, grants or policies (they live in hand-written SQL). A generated
migration that drops and recreates a table silently loses them — re-add them in the same migration.

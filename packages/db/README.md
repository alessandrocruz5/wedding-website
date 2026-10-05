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
6. `ALLOW_DEMO_SEED=1 pnpm --filter @ww/db seed:rsvp` — wipes and reloads the 8 fake `ana-and-ben`
   invitations (and every reply on them). Same guards as `db:seed`; touches no other site.
7. `pnpm --filter @ww/db test` — reads `.env`, so the isolation suite also runs live against Neon
   (otherwise that leg is reported as skipped). It asserts the connection role is not superuser,
   cannot bypass RLS, owns no tables and cannot `SET ROLE` into anything that can. Every write
   probe rolls back, so it is safe against a shared branch. On a dev branch, add
   `ALLOW_TEST_FIXTURES=1` to also run the RSVP tests (they commit fixture parties for the run;
   see [RSVP](#rsvp-invitations-guests-rsvp_responses)).

## Scripts

| Script        | Connection             | Purpose                                            |
| ------------- | ---------------------- | -------------------------------------------------- |
| `db:generate` | —                      | Diff schema → new SQL migration (never `push`)     |
| `db:migrate`  | `MIGRATE_DATABASE_URL` | Apply `drizzle/*.sql`                              |
| `db:seed`     | `MIGRATE_DATABASE_URL` | Idempotent 3-site demo data                        |
| `seed:rsvp`   | `MIGRATE_DATABASE_URL` | Wipe + reseed demo RSVP parties (`ana-and-ben`)    |
| `test`        | PGlite (+ Neon)        | Isolation suite; live leg runs when `DATABASE_URL` |

New tenant tables must add their grants + policies in a migration; the app role gets no default
privileges on purpose. Today `ww_app` may write only `site_theme`, update `sites` and submit RSVP
replies; routing, membership and identity writes arrive with the admin/auth layer (Sprint 4).

## RSVP (`invitations`, `guests`, `rsvp_responses`)

- `ww_app` may **read** parties and guests (for the exact-name lookup) and **insert** replies.
  - It may **update** only a reply's payload columns: `guests`, `shuttle`, `shuttle_seats`,
    `dietary`, `song`, `note`, `email`, `updated_at`. A reply can't be moved to another party or
    site, re-keyed or backdated.
  - It can read back only `invitation_id`, which `INSERT … ON CONFLICT (invitation_id) DO UPDATE`
    and `UPDATE … WHERE invitation_id = …` need. It never sees the email or free text.
  - So writes take no `RETURNING`, and the upsert's `SET` uses bound values, not
    `excluded.<col>` (reading `excluded` needs SELECT on that column). Set `updated_at` yourself:
    there is no trigger.
- Guests and replies reference their invitation through a composite `(site_id, invitation_id)`
  FK. FK checks bypass RLS, so this is what stops a tenant from attaching rows to another
  tenant's invitation.
- One reply row per invitation (re-submitting is an upsert). Per-guest answers live in its
  `guests` jsonb column (1–20 entries, ≤ 16 KB). The app validates that each `guestId` belongs to
  the invitation, and ignores unknown ids on read; the database does not check them.
- The grant-matrix test pins all of this.
  - The live leg loads its fixture parties only with
    `ALLOW_TEST_FIXTURES=1 pnpm --filter @ww/db test`, on a dev branch. Those rows are
    committed for the run and removed on teardown.
  - The owner and app URLs must target the same Neon endpoint and database.
  - Without the flag, the live leg still writes nothing, so it stays safe against production.

### Retention

Guest names, emails, dietary notes and messages are **personal data**. Dietary notes can reveal
health or religion (special-category data under GDPR).

- **No real PII in the demo phase.** Parties and guests on the free-tier databases, including
  production, are seeded fiction (WW-17). Replies are typed by anonymous visitors to the public
  demo, so the database refuses any email outside reserved domains
  (`rsvp_responses_email_reserved_domain`: `example.com|net|org`, `*.test|.example|.invalid`).
  Free text (`note`, `dietary`, `song`) can't be policed the same way, so it is purged on the
  schedule below.
- **Demo purge:** run the demo reseed (WW-17) before each recorded demo and at least weekly on
  production. It deletes and recreates the demo parties, and the cascade removes every reply.
- **Erase by delete; never restore over an erasure.** Deleting a site cascades to its
  invitations, guests and replies, and deleting an invitation cascades to its guests and reply.
  Neon's point-in-time restore window still holds deleted rows until it expires (short on the
  free tier).
- **Before real data:** the Guest/RSVP sprint must add consent wording, rate limiting, an admin
  export/delete path and a migration that lifts the email CHECK. Target from then on: delete a
  site's RSVP data no later than **90 days after the wedding date**, and erase an individual's
  data within 30 days of a request. That needs the wedding date on `sites` and a scheduled purge,
  neither of which exists in this package today.

⚠️ drizzle-kit does not see RLS, grants or policies (they live in hand-written SQL). A generated
migration that drops and recreates a table silently loses them — re-add them in the same migration.

import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  guests,
  invitations,
  rsvpResponses,
  siteDomains,
  siteMembers,
  sites,
  siteTheme,
  users,
} from "../schema";
import { DEMO_PLANNER, DEMO_SITES, seedDemo } from "../seed";
import {
  resolveSiteByHost,
  resolveSiteBySlug,
  withSite,
  type Database,
  type SiteTx,
} from "../tenant";

interface Backend {
  /** Returns a db connected AS THE APP ROLE, against migrated + seeded data. */
  setup: () => Promise<{ db: Database; teardown: () => Promise<void> }>;
}

// Always runs (CI included): real migration files on in-process Postgres, then drop to ww_app.
const pglite: Backend = {
  setup: async () => {
    const client = new PGlite();
    const db = drizzlePglite(client, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    });
    await seedDemo(db);
    await insertRsvpFixtures(db);
    await client.exec("SET ROLE ww_app");
    return { db, teardown: () => client.close() };
  },
};

// Live leg: DATABASE_URL (the app login role) against a migrated + seeded Neon branch.
// max: 1 forces every query onto one connection, so context leakage would be visible.
// RSVP fixtures need the owner (ww_app cannot write parties); they are removed on teardown.
const neon: Backend = {
  setup: async () => {
    if (!process.env.MIGRATE_DATABASE_URL) {
      throw new Error("The live leg needs MIGRATE_DATABASE_URL (owner) to load RSVP fixtures.");
    }
    const owner = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL, max: 1 });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    for (const p of [owner, pool]) {
      p.on("error", (error: Error) =>
        console.error("[isolation test] idle pool client error", error),
      );
    }
    const ownerDb = drizzleNeon(owner, { schema });
    await insertRsvpFixtures(ownerDb);
    return {
      db: drizzleNeon(pool, { schema }),
      teardown: async () => {
        await pool.end();
        await removeRsvpFixtures(ownerDb);
        await owner.end();
      },
    };
  },
};

const [siteA, siteB] = DEMO_SITES;

/** One party per tenant (A and B), fixed IDs. Test-only; the demo RSVP seed is WW-17. */
const RSVP_FIXTURES = [
  {
    siteId: siteA.id,
    invitationId: "1a7e0000-0000-4000-8000-0000000000a1",
    guestId: "9e570000-0000-4000-8000-0000000000a1",
    fullName: "Isolation Fixture Alpha",
  },
  {
    siteId: siteB.id,
    invitationId: "1a7e0000-0000-4000-8000-0000000000b1",
    guestId: "9e570000-0000-4000-8000-0000000000b1",
    fullName: "Isolation Fixture Bravo",
  },
] as const;
const [rsvpA, rsvpB] = RSVP_FIXTURES;

/** Idempotent. Must run as the owner role (bypasses RLS). */
async function insertRsvpFixtures(db: Database) {
  await db
    .insert(invitations)
    .values(RSVP_FIXTURES.map((f) => ({ id: f.invitationId, siteId: f.siteId, label: f.fullName })))
    .onConflictDoNothing();
  await db
    .insert(guests)
    .values(
      RSVP_FIXTURES.map((f) => ({
        id: f.guestId,
        siteId: f.siteId,
        invitationId: f.invitationId,
        fullName: f.fullName,
      })),
    )
    .onConflictDoNothing();
}

/** Owner only. Cascades to the fixtures' guests and any reply. */
async function removeRsvpFixtures(db: Database) {
  await db.delete(invitations).where(
    inArray(
      invitations.id,
      RSVP_FIXTURES.map((f) => f.invitationId),
    ),
  );
}

/** A reply for `fixture`'s party, as WW-18's server action would write it. */
function replyFor(fixture: (typeof RSVP_FIXTURES)[number], siteId: string = fixture.siteId) {
  return {
    siteId,
    invitationId: fixture.invitationId,
    guests: [{ guestId: fixture.guestId, attending: true, meal: null, events: [] }],
    email: "fixture@example.com",
  };
}

const ZERO = {
  sites: 0,
  siteDomains: 0,
  siteTheme: 0,
  users: 0,
  siteMembers: 0,
  invitations: 0,
  guests: 0,
};
const RLS_VIOLATION = /row-level security/;
const NO_GRANT = /permission denied for table/;
const SAME_SITE_FK = /rsvp_responses_invitation_same_site_fk/;

async function countAll(q: Database | SiteTx) {
  const count = async (
    table:
      | typeof sites
      | typeof siteDomains
      | typeof siteTheme
      | typeof users
      | typeof siteMembers
      | typeof invitations
      | typeof guests,
  ) => (await q.select().from(table)).length;
  return {
    sites: await count(sites),
    siteDomains: await count(siteDomains),
    siteTheme: await count(siteTheme),
    users: await count(users),
    siteMembers: await count(siteMembers),
    invitations: await count(invitations),
    guests: await count(guests),
  };
}

/** Thrown at the end of every write probe so nothing is ever committed (the live branch is shared). */
class Rollback extends Error {}

function inTx(db: Database, siteId: string | null, body: (tx: SiteTx) => Promise<unknown>) {
  return siteId ? withSite(db, siteId, body) : db.transaction(body);
}

/** Runs `fn` in a transaction that is always rolled back, returning its result. */
async function rolledBack<T>(
  db: Database,
  siteId: string | null,
  fn: (tx: SiteTx) => Promise<T>,
): Promise<T> {
  let result!: T;
  await expect(
    inTx(db, siteId, async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
  return result;
}

/** Drizzle wraps driver errors; the Postgres error (with `code`) is somewhere on the cause chain. */
function pgError(error: unknown): { code?: string; message: string } {
  let current = error as { code?: string; message?: string; cause?: unknown } | undefined;
  while (current && !current.code && current.cause) {
    current = current.cause as typeof current;
  }
  return { code: current?.code, message: current?.message ?? String(error) };
}

/** Asserts Postgres refused the write for `reason` — not some other clash or a Rollback. */
async function expectDenied(
  db: Database,
  siteId: string | null,
  write: (tx: SiteTx) => Promise<unknown>,
  reason: RegExp,
  code = "42501", // insufficient_privilege (grants and RLS)
) {
  const error = await inTx(db, siteId, async (tx) => {
    await write(tx);
    throw new Rollback();
  }).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, "write was not refused").toBeDefined();
  expect(error, "write succeeded (rolled back by the test)").not.toBeInstanceOf(Rollback);
  const pg = pgError(error);
  expect(pg.code).toBe(code);
  expect(pg.message).toMatch(reason);
}

function isolationSuite(backend: Backend) {
  let db: Database;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    ({ db, teardown } = await backend.setup());
  }, 60_000);

  afterAll(async () => {
    await teardown?.();
  });

  it("connects as a non-owner role that cannot bypass RLS", async () => {
    const { rows } = (await db.execute(sql`
      select r.rolsuper, r.rolbypassrls, pg_has_role(current_user, 'ww_app', 'member') as is_app,
             exists (select 1 from pg_tables where tableowner = current_user and schemaname = 'public') as owns_tables,
             -- SET ROLE into a privileged role (e.g. Neon's neon_superuser) would re-open the bypass.
             exists (
               select 1 from pg_roles p
               where p.rolname <> current_user and pg_has_role(current_user, p.oid, 'SET')
                 and (p.rolsuper or p.rolbypassrls
                      or exists (select 1 from pg_tables t where t.tableowner = p.rolname and t.schemaname = 'public'))
             ) as can_escalate
      from pg_roles r where r.rolname = current_user`)) as unknown as {
      rows: {
        rolsuper: boolean;
        rolbypassrls: boolean;
        is_app: boolean;
        owns_tables: boolean;
        can_escalate: boolean;
      }[];
    };
    expect(rows[0]).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      is_app: true,
      owns_tables: false,
      can_escalate: false,
    });
  });

  it("holds exactly the planned table privileges, and only it may call the resolvers", async () => {
    // Catalog check (not probes): any future accidental grant changes this matrix.
    const { rows } = (await db.execute(sql`
      select t.name || ':' || string_agg(p.priv, ',' order by p.priv) as grant
      from unnest(array['sites', 'site_domains', 'site_theme', 'users', 'site_members',
                        'invitations', 'guests', 'rsvp_responses']) as t(name)
      cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(priv)
      where has_table_privilege(current_user, 'public.' || t.name, p.priv)
      group by t.name order by t.name`)) as unknown as { rows: { grant: string }[] };
    expect(rows.map((r) => r.grant)).toEqual([
      "guests:SELECT",
      "invitations:SELECT",
      "rsvp_responses:INSERT,UPDATE",
      "site_domains:SELECT",
      "site_members:SELECT",
      "site_theme:DELETE,INSERT,SELECT,UPDATE",
      "sites:SELECT,UPDATE",
      "users:SELECT",
    ]);

    // Replies are PII: only the key columns an upsert / UPDATE ... WHERE must read are selectable.
    const cols = (await db.execute(sql`
      select string_agg(c.column_name, ',' order by c.column_name) as cols
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'rsvp_responses'
        and has_column_privilege(current_user, 'public.rsvp_responses', c.column_name, 'SELECT')`)) as unknown as {
      rows: { cols: string }[];
    };
    expect(cols.rows[0]?.cols).toBe("id,invitation_id,site_id");

    const fns = (await db.execute(sql`
      select f.sig, has_function_privilege(current_user, f.sig, 'EXECUTE') as app,
             has_function_privilege('public', f.sig, 'EXECUTE') as public
      from unnest(array['public.ww_resolve_site_by_host(text)', 'public.ww_resolve_site_by_slug(text)']) as f(sig)
      order by f.sig`)) as unknown as { rows: { sig: string; app: boolean; public: boolean }[] };
    expect(fns.rows).toEqual([
      { sig: "public.ww_resolve_site_by_host(text)", app: true, public: false },
      { sig: "public.ww_resolve_site_by_slug(text)", app: true, public: false },
    ]);
  });

  it("has RLS enabled and forced on every table in public", async () => {
    const { rows } = (await db.execute(sql`
      select c.relname as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`)) as unknown as {
      rows: { name: string; enabled: boolean; forced: boolean }[];
    };
    const tables = rows.filter((r) => r.name !== "__drizzle_migrations");
    expect(tables.map((r) => r.name)).toEqual([
      "guests",
      "invitations",
      "rsvp_responses",
      "site_domains",
      "site_members",
      "site_theme",
      "sites",
      "users",
    ]);
    expect(tables.filter((r) => !r.enabled || !r.forced)).toEqual([]);
  });

  it("each demo tenant sees exactly its own seeded rows", async () => {
    for (const [i, site] of DEMO_SITES.entries()) {
      const people = i < 2 ? 2 : 1; // owner (+ shared planner on the first two sites)
      // RSVP rows are covered below; their count depends on the (WW-17) demo seed.
      expect(await withSite(db, site.id, (tx) => countAll(tx)), site.slug).toMatchObject({
        sites: 1,
        siteDomains: site.hostnames.length,
        siteTheme: 1,
        users: people,
        siteMembers: people,
      });
    }
  });

  describe("no tenant context", () => {
    it("returns 0 rows from every tenant table", async () => {
      expect(await countAll(db)).toEqual(ZERO);
    });

    it("returns 0 rows inside a transaction that never called withSite", async () => {
      expect(await db.transaction((tx) => countAll(tx))).toEqual(ZERO);
    });

    it("cannot write", async () => {
      await expectDenied(
        db,
        null,
        (tx) => tx.insert(siteTheme).values({ siteId: siteA.id }),
        RLS_VIOLATION,
      );
      expect(
        await rolledBack(db, null, (tx) =>
          tx.update(siteTheme).set({ preset: "hijacked" }).returning(),
        ),
      ).toHaveLength(0);
    });
  });

  describe("within withSite(A)", () => {
    it("sees exactly A's rows", async () => {
      const seen = await withSite(db, siteA.id, async (tx) => ({
        sites: (await tx.select({ id: sites.id }).from(sites)).map((r) => r.id),
        domainSites: (await tx.select({ id: siteDomains.siteId }).from(siteDomains)).map(
          (r) => r.id,
        ),
        users: (await tx.select({ id: users.id }).from(users)).map((r) => r.id).sort(),
      }));
      expect(seen.sites).toEqual([siteA.id]);
      expect(seen.domainSites).toEqual([siteA.id]);
      expect(seen.users).toEqual([siteA.owner.id, DEMO_PLANNER.id].sort());
    });

    it("returns 0 rows when explicitly querying B (cross-tenant read)", async () => {
      const cross = await withSite(db, siteA.id, async (tx) => ({
        sites: (await tx.select().from(sites).where(eq(sites.id, siteB.id))).length,
        siteDomains: (await tx.select().from(siteDomains).where(eq(siteDomains.siteId, siteB.id)))
          .length,
        siteTheme: (await tx.select().from(siteTheme).where(eq(siteTheme.siteId, siteB.id))).length,
        users: (await tx.select().from(users).where(eq(users.id, siteB.owner.id))).length,
        siteMembers: (await tx.select().from(siteMembers).where(eq(siteMembers.siteId, siteB.id)))
          .length,
        invitations: (await tx.select().from(invitations).where(eq(invitations.siteId, siteB.id)))
          .length,
        guests: (await tx.select().from(guests).where(eq(guests.siteId, siteB.id))).length,
      }));
      expect(cross).toEqual(ZERO);
    });

    it("cannot see a shared user's membership of other sites", async () => {
      const memberships = await withSite(db, siteA.id, (tx) =>
        tx.select().from(siteMembers).where(eq(siteMembers.userId, DEMO_PLANNER.id)),
      );
      expect(memberships.map((m) => m.siteId)).toEqual([siteA.id]);
    });

    it("RLS refuses writes that would create or move rows out of A", async () => {
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.insert(siteTheme).values({ siteId: siteB.id }),
        RLS_VIOLATION,
      );
      // No WHERE: a WHERE would also apply the SELECT policy to the new row and mask WITH CHECK.
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.update(siteTheme).set({ siteId: siteB.id }),
        RLS_VIOLATION,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.update(sites).set({ id: "5a1e0000-0000-4000-8000-0000000000ff" }),
        RLS_VIOLATION,
      );
    });

    it("updates and deletes aimed at B affect 0 rows", async () => {
      const affected = await rolledBack(db, siteA.id, async (tx) => ({
        sites: (
          await tx.update(sites).set({ name: "hijacked" }).where(eq(sites.id, siteB.id)).returning()
        ).length,
        siteThemeUpdated: (
          await tx
            .update(siteTheme)
            .set({ preset: "hijacked" })
            .where(eq(siteTheme.siteId, siteB.id))
            .returning()
        ).length,
        siteThemeDeleted: (
          await tx.delete(siteTheme).where(eq(siteTheme.siteId, siteB.id)).returning()
        ).length,
      }));
      expect(affected).toEqual({ sites: 0, siteThemeUpdated: 0, siteThemeDeleted: 0 });
    });

    it("scopes a blanket UPDATE (no WHERE, so only the UPDATE policy applies) to A", async () => {
      const epoch = new Date(0);
      const bAfter = await rolledBack(db, siteA.id, async (tx) => {
        await tx.update(sites).set({ updatedAt: epoch });
        await tx.update(siteTheme).set({ updatedAt: epoch });
        // Peek at B inside the same (rolled-back) transaction.
        await tx.execute(sql`select set_config('app.site_id', ${siteB.id}, true)`);
        return {
          site: (await tx.select({ at: sites.updatedAt }).from(sites))[0]?.at.getTime(),
          theme: (await tx.select({ at: siteTheme.updatedAt }).from(siteTheme))[0]?.at.getTime(),
        };
      });
      expect(bAfter.site).toBeDefined();
      expect(bAfter.site).not.toBe(0);
      expect(bAfter.theme).toBeDefined();
      expect(bAfter.theme).not.toBe(0);
    });

    it("has no write grant on routing, membership or identity tables", async () => {
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.insert(siteDomains).values({ siteId: siteA.id, hostname: "new.example.com" }),
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.insert(siteMembers).values({ siteId: siteA.id, userId: siteB.owner.id }),
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.delete(siteMembers).where(eq(siteMembers.siteId, siteA.id)),
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.update(users).set({ name: "hijacked" }),
        NO_GRANT,
      );
    });
  });

  describe("RSVP tables", () => {
    it("within withSite(A), sees only A's parties and guests", async () => {
      const seen = await withSite(db, siteA.id, async (tx) => ({
        invitations: await tx
          .select({ id: invitations.id, siteId: invitations.siteId })
          .from(invitations),
        guests: await tx.select({ id: guests.id, siteId: guests.siteId }).from(guests),
      }));
      expect(seen.invitations.map((r) => r.id)).toContain(rsvpA.invitationId);
      expect(seen.guests.map((r) => r.id)).toContain(rsvpA.guestId);
      expect(new Set([...seen.invitations, ...seen.guests].map((r) => r.siteId))).toEqual(
        new Set([siteA.id]),
      );
    });

    it("returns 0 rows when looking up B's party by id or exact name (cross-tenant read)", async () => {
      const cross = await withSite(db, siteA.id, async (tx) => ({
        invitation: (
          await tx.select().from(invitations).where(eq(invitations.id, rsvpB.invitationId))
        ).length,
        guestById: (await tx.select().from(guests).where(eq(guests.id, rsvpB.guestId))).length,
        guestByName: (
          await tx
            .select()
            .from(guests)
            .where(sql`lower(${guests.fullName}) = lower(${rsvpB.fullName})`)
        ).length,
      }));
      expect(cross).toEqual({ invitation: 0, guestById: 0, guestByName: 0 });
      // ...while B itself finds it by the same exact-name lookup.
      const own = await withSite(db, siteB.id, (tx) =>
        tx
          .select({ invitationId: guests.invitationId })
          .from(guests)
          .where(sql`lower(${guests.fullName}) = lower(${rsvpB.fullName})`),
      );
      expect(own).toEqual([{ invitationId: rsvpB.invitationId }]);
    });

    it("can submit and re-submit its own reply (upsert) but never read it back", async () => {
      const upsert = (tx: SiteTx, note: string) =>
        tx
          .insert(rsvpResponses)
          .values({ ...replyFor(rsvpA), note })
          .onConflictDoUpdate({
            target: rsvpResponses.invitationId,
            set: { note, updatedAt: new Date() },
          })
          .returning({ id: rsvpResponses.id });
      const ids = await rolledBack(db, siteA.id, async (tx) => [
        ...(await upsert(tx, "first")),
        ...(await upsert(tx, "second")),
      ]);
      expect(ids).toHaveLength(2);
      expect(ids[0]?.id).toBe(ids[1]?.id);

      await expectDenied(
        db,
        siteA.id,
        async (tx) => {
          await tx.insert(rsvpResponses).values(replyFor(rsvpA));
          return tx.select().from(rsvpResponses);
        },
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        async (tx) => {
          await tx.insert(rsvpResponses).values(replyFor(rsvpA));
          return tx.select({ email: rsvpResponses.email }).from(rsvpResponses);
        },
        NO_GRANT,
      );
    });

    it("refuses replies stamped with, or aimed at, another tenant", async () => {
      // Stamped with B's site_id: RLS WITH CHECK.
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.insert(rsvpResponses).values(replyFor(rsvpB)),
        RLS_VIOLATION,
      );
      // Own site_id + B's invitation: RLS passes, the composite (site_id, invitation_id) FK refuses.
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.insert(rsvpResponses).values(replyFor(rsvpB, siteA.id)),
        SAME_SITE_FK,
        "23503",
      );
      // Moving A's own reply to B: RLS WITH CHECK (no WHERE, so only the UPDATE policy applies).
      await expectDenied(
        db,
        siteA.id,
        async (tx) => {
          await tx.insert(rsvpResponses).values(replyFor(rsvpA));
          return tx.update(rsvpResponses).set({ siteId: siteB.id });
        },
        RLS_VIOLATION,
      );
      // No context at all.
      await expectDenied(
        db,
        null,
        (tx) => tx.insert(rsvpResponses).values(replyFor(rsvpA)),
        RLS_VIOLATION,
      );
    });

    it("updates aimed at B's reply affect 0 rows", async () => {
      const affected = await rolledBack(db, siteB.id, async (tx) => {
        await tx.insert(rsvpResponses).values(replyFor(rsvpB));
        // Same (rolled-back) transaction, now acting as A.
        await tx.execute(sql`select set_config('app.site_id', ${siteA.id}, true)`);
        return {
          targeted: (
            await tx
              .update(rsvpResponses)
              .set({ note: "hijacked" })
              .where(eq(rsvpResponses.invitationId, rsvpB.invitationId))
              .returning({ id: rsvpResponses.id })
          ).length,
          blanket: (
            await tx
              .update(rsvpResponses)
              .set({ note: "hijacked" })
              .returning({ id: rsvpResponses.id })
          ).length,
        };
      });
      expect(affected).toEqual({ targeted: 0, blanket: 0 });
    });

    it("has no write grant on parties or guests, and cannot delete replies", async () => {
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.insert(invitations).values({ siteId: siteA.id, label: "Gatecrashers" }),
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) =>
          tx.insert(guests).values({
            siteId: siteA.id,
            invitationId: rsvpA.invitationId,
            fullName: "Plus One",
          }),
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.update(guests).set({ fullName: "hijacked" }),
        NO_GRANT,
      );
      await expectDenied(
        db,
        siteA.id,
        (tx) => tx.delete(rsvpResponses).where(eq(rsvpResponses.invitationId, rsvpA.invitationId)),
        NO_GRANT,
      );
    });
  });

  it("does not leak context past the transaction on the same connection", async () => {
    expect((await withSite(db, siteA.id, (tx) => tx.select().from(sites))).length).toBe(1);
    expect(await countAll(db)).toEqual(ZERO);
  });

  it("does not leak context when the transaction rolls back", async () => {
    await expect(
      withSite(db, siteA.id, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await countAll(db)).toEqual(ZERO);
  });

  it("refuses to switch tenant inside a running withSite (nested call)", async () => {
    // A nested savepoint's set_config survives RELEASE, so a nested switch would silently
    // re-scope the rest of the outer callback to B.
    await expect(
      withSite(db, siteA.id, async (tx) => {
        await withSite(tx, siteB.id, async () => undefined);
        return tx.select().from(sites);
      }),
    ).rejects.toThrow(/already scoped/);
    // Re-entering the same tenant is harmless and allowed.
    const rows = await withSite(db, siteA.id, (tx) =>
      withSite(tx, siteA.id.toUpperCase(), (inner) => inner.select({ id: sites.id }).from(sites)),
    );
    expect(rows).toEqual([{ id: siteA.id }]);
  });

  it("rejects a non-UUID site id before touching the database", async () => {
    await expect(withSite(db, "' or true --", async () => 1)).rejects.toThrow(TypeError);
    await expect(withSite(db, "", async () => 1)).rejects.toThrow(TypeError);
  });

  describe("site resolution (no context required)", () => {
    it("resolves by host, case-insensitively, exposing only id + slug", async () => {
      expect(await resolveSiteByHost(db, "Ana-And-Ben.localhost")).toEqual({
        id: siteA.id,
        slug: siteA.slug,
      });
      expect(await resolveSiteByHost(db, "eliandfaye.example.com")).toEqual({
        id: DEMO_SITES[2].id,
        slug: DEMO_SITES[2].slug,
      });
    });

    it("resolves by slug", async () => {
      expect(await resolveSiteBySlug(db, siteB.slug)).toEqual({ id: siteB.id, slug: siteB.slug });
    });

    it("returns null for unknown host/slug", async () => {
      expect(await resolveSiteByHost(db, "unknown.example.com")).toBeNull();
      expect(await resolveSiteBySlug(db, "nobody")).toBeNull();
    });
  });
}

describe("tenant isolation (pglite)", () => isolationSuite(pglite));

describe.skipIf(!process.env.DATABASE_URL)(
  "tenant isolation (neon — skipped unless DATABASE_URL is set)",
  () => isolationSuite(neon),
);

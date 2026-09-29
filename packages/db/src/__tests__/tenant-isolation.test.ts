import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { siteDomains, siteMembers, sites, siteTheme, users } from "../schema";
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
    await client.exec("SET ROLE ww_app");
    return { db, teardown: () => client.close() };
  },
};

// Live leg: DATABASE_URL (the app login role) against a migrated + seeded Neon branch.
// max: 1 forces every query onto one connection, so context leakage would be visible.
const neon: Backend = {
  setup: async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    return { db: drizzleNeon(pool, { schema }), teardown: () => pool.end() };
  },
};

const [siteA, siteB] = DEMO_SITES;
const ZERO = { sites: 0, siteDomains: 0, siteTheme: 0, users: 0, siteMembers: 0 };
const RLS_VIOLATION = /row-level security/;
const NO_GRANT = /permission denied for table/;

async function countAll(q: Database | SiteTx) {
  const count = async (
    table: typeof sites | typeof siteDomains | typeof siteTheme | typeof users | typeof siteMembers,
  ) => (await q.select().from(table)).length;
  return {
    sites: await count(sites),
    siteDomains: await count(siteDomains),
    siteTheme: await count(siteTheme),
    users: await count(users),
    siteMembers: await count(siteMembers),
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

/** Asserts Postgres refused the write for `reason` — not a unique/FK clash or a Rollback. */
async function expectDenied(
  db: Database,
  siteId: string | null,
  write: (tx: SiteTx) => Promise<unknown>,
  reason: RegExp,
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
  expect(pg.code).toBe("42501");
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

  it("each demo tenant sees exactly its own seeded rows", async () => {
    for (const [i, site] of DEMO_SITES.entries()) {
      const people = i < 2 ? 2 : 1; // owner (+ shared planner on the first two sites)
      expect(await withSite(db, site.id, (tx) => countAll(tx)), site.slug).toEqual({
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

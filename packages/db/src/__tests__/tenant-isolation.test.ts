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
  name: string;
  /** Returns a db connected AS THE APP ROLE, against migrated + seeded data. */
  setup: () => Promise<{ db: Database; teardown: () => Promise<void> }>;
}

// Always runs (CI included): real migration files on in-process Postgres, then drop to ww_app.
const pglite: Backend = {
  name: "pglite",
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

// Runs when DATABASE_URL (the app login role) is set against a migrated + seeded Neon branch.
// max: 1 forces every query onto one connection, so context leakage would be visible.
const neon: Backend = {
  name: "neon",
  setup: async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    return { db: drizzleNeon(pool, { schema }), teardown: () => pool.end() };
  },
};

const backends = process.env.DATABASE_URL ? [pglite, neon] : [pglite];

const [siteA, siteB] = DEMO_SITES;

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

const ZERO = { sites: 0, siteDomains: 0, siteTheme: 0, users: 0, siteMembers: 0 };

describe.each(backends)("tenant isolation ($name)", (backend) => {
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

  describe("no tenant context", () => {
    it("returns 0 rows from every tenant table", async () => {
      expect(await countAll(db)).toEqual(ZERO);
    });

    it("returns 0 rows inside a transaction that never called withSite", async () => {
      expect(await db.transaction((tx) => countAll(tx))).toEqual(ZERO);
    });

    it("cannot write", async () => {
      await expect(
        db.insert(siteDomains).values({ siteId: siteA.id, hostname: "no-context.example.com" }),
      ).rejects.toThrow();
      expect(await db.update(siteTheme).set({ preset: "hijacked" }).returning()).toHaveLength(0);
    });
  });

  describe("within withSite(A)", () => {
    it("sees exactly A's rows", async () => {
      const counts = await withSite(db, siteA.id, (tx) => countAll(tx));
      // A: 1 site, 1 domain, 1 theme, owner + planner as members/users.
      expect(counts).toEqual({ sites: 1, siteDomains: 1, siteTheme: 1, users: 2, siteMembers: 2 });

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

    it("cannot insert, update or delete B's rows (cross-tenant write)", async () => {
      await expect(
        withSite(db, siteA.id, (tx) =>
          tx.insert(siteDomains).values({ siteId: siteB.id, hostname: "cross-tenant.example.com" }),
        ),
      ).rejects.toThrow();
      await expect(
        withSite(db, siteA.id, (tx) =>
          tx
            .insert(siteMembers)
            .values({ siteId: siteB.id, userId: siteA.owner.id, role: "owner" }),
        ),
      ).rejects.toThrow();
      await expect(
        withSite(db, siteA.id, (tx) =>
          tx.update(siteDomains).set({ siteId: siteB.id }).where(eq(siteDomains.siteId, siteA.id)),
        ),
      ).rejects.toThrow();

      const affected = await withSite(db, siteA.id, async (tx) => ({
        sites: (
          await tx.update(sites).set({ name: "hijacked" }).where(eq(sites.id, siteB.id)).returning()
        ).length,
        siteTheme: (
          await tx
            .update(siteTheme)
            .set({ preset: "hijacked" })
            .where(eq(siteTheme.siteId, siteB.id))
            .returning()
        ).length,
        siteDomains: (
          await tx.delete(siteDomains).where(eq(siteDomains.siteId, siteB.id)).returning()
        ).length,
        siteMembers: (
          await tx.delete(siteMembers).where(eq(siteMembers.siteId, siteB.id)).returning()
        ).length,
      }));
      expect(affected).toEqual({ sites: 0, siteTheme: 0, siteDomains: 0, siteMembers: 0 });
    });

    it("scopes a blanket UPDATE (no WHERE, so only the UPDATE policy applies) to A", async () => {
      class Rollback extends Error {}
      // Touching B would violate RLS instead of reaching our Rollback; rolled back either way.
      await expect(
        withSite(db, siteA.id, async (tx) => {
          await tx.update(sites).set({ updatedAt: new Date(0) });
          await tx.update(siteTheme).set({ updatedAt: new Date(0) });
          throw new Rollback();
        }),
      ).rejects.toBeInstanceOf(Rollback);
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
});

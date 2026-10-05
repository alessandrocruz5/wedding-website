import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { guests, invitations, rsvpResponses } from "../schema";
import { DEMO_SITES, seedDemo } from "../seed";
import { assertSeedAllowed, DEMO_RSVP_PARTY_IDS, seedRsvp } from "../seed-rsvp";

const [demo, other] = DEMO_SITES;
const FIXTURE_ID = "1a7e0000-0000-4000-8000-0000000000a1";
const OTHER_ID = "1a7e0000-0000-4000-8000-0000000000b1";

const client = new PGlite();
const db = drizzle(client, { schema });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  await seedDemo(db);
});
afterAll(() => client.close());

// createdAt is excluded: the reseed recreates the rows.
const snapshot = async () => ({
  invitations: (await db.select().from(invitations).orderBy(invitations.id)).map(
    ({ createdAt: _, ...rest }) => rest,
  ),
  guests: (await db.select().from(guests).orderBy(guests.id)).map(
    ({ createdAt: _, ...rest }) => rest,
  ),
});

describe("seedRsvp", () => {
  beforeEach(async () => {
    await db.delete(invitations); // cascades guests + replies
  });

  it("seeds ~8 invitations on ana-and-ben only, incl. a family and a plus-one", async () => {
    await seedRsvp(db);
    const rows = await db.select().from(invitations);
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.siteId === demo.id)).toBe(true);
    expect(rows.some((r) => /family/i.test(r.label))).toBe(true);
    expect(rows.some((r) => r.label.endsWith("+ 1"))).toBe(true);
    const gs = await db.select().from(guests);
    expect(gs.every((g) => g.siteId === demo.id)).toBe(true);
    expect(gs.length).toBeGreaterThan(rows.length);
  });

  it("is idempotent", async () => {
    await seedRsvp(db);
    const first = await snapshot();
    await seedRsvp(db);
    expect(await snapshot()).toEqual(first);
  });

  it("wipes replies on reseed", async () => {
    await seedRsvp(db);
    const [guest] = await db.select().from(guests).limit(1);
    await db.insert(rsvpResponses).values({
      siteId: demo.id,
      invitationId: guest!.invitationId,
      guests: [{ guestId: guest!.id, attending: true, meal: null, events: [] }],
      email: "you@example.com",
    });
    await seedRsvp(db);
    expect(await db.select().from(rsvpResponses)).toHaveLength(0);
  });

  it("leaves other sites and test fixtures untouched", async () => {
    await db.insert(invitations).values([
      { id: OTHER_ID, siteId: other.id, label: "Other site party" },
      { id: FIXTURE_ID, siteId: demo.id, label: "Fixture" },
    ]);
    await seedRsvp(db);
    await seedRsvp(db);
    const rows = await db.select().from(invitations).where(eq(invitations.siteId, other.id));
    expect(rows.map((r) => r.id)).toEqual([OTHER_ID]);
    const ids = (await db.select().from(invitations)).map((r) => r.id);
    expect(ids).toContain(FIXTURE_ID);
    expect(ids).toHaveLength(DEMO_RSVP_PARTY_IDS.length + 2);
  });
});

describe("assertSeedAllowed", () => {
  it("requires ALLOW_DEMO_SEED=1", () => {
    expect(() => assertSeedAllowed("development", undefined)).toThrow(/ALLOW_DEMO_SEED/);
    expect(() => assertSeedAllowed("development", "0")).toThrow();
    expect(() => assertSeedAllowed("development", "1")).not.toThrow();
  });
  it("refuses production even when opted in", () => {
    expect(() => assertSeedAllowed("production", "1")).toThrow();
  });
});

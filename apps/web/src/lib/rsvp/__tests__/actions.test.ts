import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type * as WwDb from "@ww/db";
import { getPoolDb } from "@ww/db";
import * as schema from "@ww/db/schema";
import { guests, invitations, rsvpResponses, sites } from "@ww/db/schema";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSite } from "../../site";
import { lookupInvitation, submitRsvp } from "../actions";
import type { RsvpSubmissionInput } from "../schema";

// The real actions against the real migrations, as ww_app. Only the request plumbing is stubbed:
// the site header (middleware), getSite (resolution + cache) and the pool (-> PGlite).
let siteKey: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(siteKey ? { "x-ww-site": siteKey } : {}),
}));
vi.mock("../../site", () => ({ getSite: vi.fn() }));
vi.mock("@ww/db", async (importOriginal) => ({
  ...(await importOriginal<typeof WwDb>()),
  getPoolDb: vi.fn(),
}));

const id = (prefix: string, n: number) =>
  `${prefix}0000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const SITE_A = { id: id("5173", 0xa), slug: "site-a", name: "Site A" };
const SITE_B = { id: id("5173", 0xb), slug: "site-b", name: "Site B" };
const PARTY_A = {
  siteId: SITE_A.id,
  id: id("1a7e", 0xa1),
  label: "Maya Santos & Leo Park",
  guests: [
    { id: id("9e57", 0xa11), fullName: "Maya Santos", sortOrder: 0 },
    { id: id("9e57", 0xa12), fullName: "Leo Park", sortOrder: 1 },
  ],
};
const PARTY_A2 = {
  siteId: SITE_A.id,
  id: id("1a7e", 0xa2),
  label: "Rosa Mendez",
  guests: [{ id: id("9e57", 0xa21), fullName: "Rosa Mendez", sortOrder: 0 }],
};
const PARTY_B = {
  siteId: SITE_B.id,
  id: id("1a7e", 0xb1),
  label: "Jun Tanaka + 1",
  guests: [
    { id: id("9e57", 0xb11), fullName: "Jun Tanaka", sortOrder: 0 },
    { id: id("9e57", 0xb12), fullName: "Guest of Jun Tanaka", sortOrder: 1 },
  ],
};
// The same name in two parties of one site: lookup must not pick one.
const DUPES = [
  { siteId: SITE_A.id, id: id("1a7e", 0xa3), label: "Alex Kim (1)", guestId: id("9e57", 0xa31) },
  { siteId: SITE_A.id, id: id("1a7e", 0xa4), label: "Alex Kim (2)", guestId: id("9e57", 0xa41) },
];
const PII = [PARTY_A, PARTY_A2, PARTY_B].flatMap((p) => p.guests.map((g) => g.fullName));

const client = new PGlite();
const db = drizzle(client, { schema });

/** Fixtures and assertions read as the owner (bypasses RLS); the actions always run as ww_app. */
async function asOwner<T>(fn: () => Promise<T>): Promise<T> {
  await client.exec("RESET ROLE");
  try {
    return await fn();
  } finally {
    await client.exec("SET ROLE ww_app");
  }
}

const storedReplies = () => asOwner(() => db.select().from(rsvpResponses));

function on(site: typeof SITE_A | typeof SITE_B) {
  siteKey = `s.${site.slug}`;
}

function replyForA(overrides: Partial<RsvpSubmissionInput> = {}): RsvpSubmissionInput {
  return {
    invitationId: PARTY_A.id,
    guests: [
      { guestId: PARTY_A.guests[0]!.id, attending: true, meal: "halibut", events: ["welcome"] },
      { guestId: PARTY_A.guests[1]!.id, attending: false, meal: null, events: [] },
    ],
    shuttle: "arlo",
    shuttleSeats: 1,
    dietary: "No shellfish",
    song: null,
    note: "  See you there!  ",
    email: "maya@example.com",
    ...overrides,
  };
}

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../../../../../packages/db/drizzle", import.meta.url),
    ),
  });
  await db.insert(sites).values([SITE_A, SITE_B]);
  await db
    .insert(invitations)
    .values([
      ...[PARTY_A, PARTY_A2, PARTY_B].map(({ id, siteId, label }) => ({ id, siteId, label })),
      ...DUPES.map(({ id, siteId, label }) => ({ id, siteId, label })),
    ]);
  await db.insert(guests).values([
    ...[PARTY_A, PARTY_A2, PARTY_B].flatMap((p) =>
      p.guests.map((g) => ({ ...g, siteId: p.siteId, invitationId: p.id })),
    ),
    ...DUPES.map((d) => ({
      id: d.guestId,
      siteId: d.siteId,
      invitationId: d.id,
      fullName: "Alex Kim",
    })),
  ]);
  await client.exec("SET ROLE ww_app");

  vi.mocked(getPoolDb).mockReturnValue(db as unknown as ReturnType<typeof getPoolDb>);
  vi.mocked(getSite).mockImplementation(async (key) => {
    const site = [SITE_A, SITE_B].find((s) => key === `s.${s.slug}`);
    return site ? { ...site, theme: { preset: "default", tokens: {} } } : null;
  });
});
afterAll(() => client.close());

beforeEach(async () => {
  on(SITE_A);
  await asOwner(() => db.delete(rsvpResponses));
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

// No guest data in any log line, whatever the test did.
afterEach(() => {
  const logged = JSON.stringify(consoleSpies.flatMap((s) => s.mock.calls)).toLowerCase();
  for (const value of [...PII, "maya@example.com", "No shellfish"]) {
    expect(logged).not.toContain(value.toLowerCase());
  }
  consoleSpies.forEach((s) => s.mockRestore());
});

describe("lookupInvitation", () => {
  it("finds the whole party from one guest's name, case- and space-insensitively", async () => {
    const expected = {
      invitationId: PARTY_A.id,
      guests: PARTY_A.guests.map((g) => ({ id: g.id, name: g.fullName })),
    };
    expect(await lookupInvitation("Leo Park")).toEqual(expected);
    expect(await lookupInvitation("  maya   SANTOS ")).toEqual(expected);
  });

  it("returns null for an unknown name, partial match or junk input", async () => {
    expect(await lookupInvitation("Nobody Here")).toBeNull();
    expect(await lookupInvitation("Maya")).toBeNull();
    expect(await lookupInvitation("%")).toBeNull();
    expect(await lookupInvitation("")).toBeNull();
    expect(await lookupInvitation("x".repeat(201))).toBeNull();
    expect(await lookupInvitation(42)).toBeNull();
    expect(await lookupInvitation({ name: "Maya Santos" })).toBeNull();
  });

  it("returns null when the name is in more than one party", async () => {
    expect(await lookupInvitation("Alex Kim")).toBeNull();
  });

  it("returns null without a resolvable site", async () => {
    siteKey = null;
    expect(await lookupInvitation("Maya Santos")).toBeNull();
    siteKey = "s.no-such-site";
    expect(await lookupInvitation("Maya Santos")).toBeNull();
  });
});

describe("submitRsvp", () => {
  it("stores the validated reply on the current site", async () => {
    expect(await submitRsvp(replyForA())).toEqual({ ok: true });
    const [row, ...rest] = await storedReplies();
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({
      siteId: SITE_A.id,
      invitationId: PARTY_A.id,
      guests: replyForA().guests,
      shuttle: "arlo",
      shuttleSeats: 1,
      dietary: "No shellfish",
      song: null,
      note: "See you there!",
      email: "maya@example.com",
    });
  });

  it("is idempotent per invitation: a resubmit updates the one row in place", async () => {
    await submitRsvp(replyForA());
    const [first] = await storedReplies();
    expect(await submitRsvp(replyForA())).toEqual({ ok: true });

    const changed = replyForA({
      guests: [
        { guestId: PARTY_A.guests[0]!.id, attending: false, meal: null, events: [] },
        { guestId: PARTY_A.guests[1]!.id, attending: false, meal: null, events: [] },
      ],
      shuttle: null,
      shuttleSeats: 0,
      dietary: "",
      note: null,
      email: "maya.santos@example.org",
    });
    expect(await submitRsvp(changed)).toEqual({ ok: true });

    const rows = await storedReplies();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: first!.id,
      submittedAt: first!.submittedAt,
      guests: changed.guests,
      shuttle: null,
      shuttleSeats: 0,
      dietary: null,
      note: null,
      email: "maya.santos@example.org",
    });
    expect(rows[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(first!.updatedAt.getTime());
  });

  it.each([
    ["a non-object payload", "nope"],
    ["a bad invitation id", replyForA({ invitationId: "not-a-uuid" })],
    ["no guests", replyForA({ guests: [] })],
    ["an over-long note", replyForA({ note: "x".repeat(2001) })],
    ["an over-long dietary note", replyForA({ dietary: "x".repeat(1001) })],
    ["free text as a shuttle option", replyForA({ shuttle: "Pick me up at 5 Main St" })],
    ["more seats than attending guests", replyForA({ shuttleSeats: 2 })],
    ["a smuggled siteId", { ...replyForA(), siteId: SITE_B.id }],
    [
      "a decliner with a meal",
      replyForA({
        guests: [
          { guestId: PARTY_A.guests[0]!.id, attending: true, meal: null, events: [] },
          { guestId: PARTY_A.guests[1]!.id, attending: false, meal: "halibut", events: [] },
        ],
      }),
    ],
    [
      "a guest listed twice",
      replyForA({
        guests: [
          { guestId: PARTY_A.guests[0]!.id, attending: true, meal: null, events: [] },
          { guestId: PARTY_A.guests[0]!.id, attending: true, meal: null, events: [] },
        ],
      }),
    ],
    [
      "a guest from another party",
      replyForA({
        guests: [
          { guestId: PARTY_A.guests[0]!.id, attending: true, meal: null, events: [] },
          { guestId: PARTY_A2.guests[0]!.id, attending: true, meal: null, events: [] },
        ],
      }),
    ],
    [
      "part of the party missing",
      replyForA({
        guests: [{ guestId: PARTY_A.guests[0]!.id, attending: true, meal: null, events: [] }],
      }),
    ],
  ])("rejects %s and writes nothing", async (_, payload) => {
    expect(await submitRsvp(payload)).toEqual({ ok: false, error: expect.stringMatching(/check/) });
    expect(await storedReplies()).toHaveLength(0);
  });

  it.each(["maya@gmail.com", "not-an-email", "maya@example.com.evil.io"])(
    "rejects %s with the example-address hint",
    async (email) => {
      expect(await submitRsvp(replyForA({ email }))).toEqual({
        ok: false,
        error: expect.stringMatching(/you@example\.com/),
      });
      expect(await storedReplies()).toHaveLength(0);
    },
  );

  it("rejects an unknown invitation", async () => {
    const result = await submitRsvp(replyForA({ invitationId: id("1a7e", 0xfff) }));
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/couldn’t find/) });
    expect(await storedReplies()).toHaveLength(0);
  });

  it("refuses without a resolvable site", async () => {
    siteKey = null;
    expect(await submitRsvp(replyForA())).toMatchObject({ ok: false });
    expect(await storedReplies()).toHaveLength(0);
  });
});

describe("cross-site isolation", () => {
  it("lookup never finds another site's guests", async () => {
    on(SITE_A);
    expect(await lookupInvitation("Jun Tanaka")).toBeNull();
    on(SITE_B);
    expect(await lookupInvitation("Maya Santos")).toBeNull();
    expect(await lookupInvitation("Jun Tanaka")).toMatchObject({ invitationId: PARTY_B.id });
  });

  it("a reply for another site's party is refused and writes nothing", async () => {
    on(SITE_A);
    const forB = replyForA({
      invitationId: PARTY_B.id,
      guests: PARTY_B.guests.map((g) => ({
        guestId: g.id,
        attending: false,
        meal: null,
        events: [],
      })),
      shuttle: null,
      shuttleSeats: 0,
    });
    expect(await submitRsvp(forB)).toEqual({
      ok: false,
      error: expect.stringMatching(/couldn’t find/),
    });
    expect(await storedReplies()).toHaveLength(0);

    on(SITE_B);
    expect(await submitRsvp(forB)).toEqual({ ok: true });
    expect(await storedReplies()).toMatchObject([{ siteId: SITE_B.id, invitationId: PARTY_B.id }]);
  });

  it("site A can't overwrite site B's existing reply", async () => {
    on(SITE_B);
    const forB = replyForA({
      invitationId: PARTY_B.id,
      guests: PARTY_B.guests.map((g) => ({
        guestId: g.id,
        attending: false,
        meal: null,
        events: [],
      })),
      shuttle: null,
      shuttleSeats: 0,
      note: "original",
    });
    await submitRsvp(forB);
    on(SITE_A);
    expect(await submitRsvp({ ...forB, note: "hijacked" })).toMatchObject({ ok: false });
    expect(await storedReplies()).toMatchObject([{ siteId: SITE_B.id, note: "original" }]);
  });
});

describe("failures don't leak guest data", () => {
  // Drizzle's error message quotes the query params, as the real driver error would.
  const failingDb = {
    transaction: async () => {
      throw Object.assign(new Error("Failed query: … params: maya santos,maya@example.com"), {
        cause: { code: "57P01" },
      });
    },
  } as unknown as ReturnType<typeof getPoolDb>;

  it("lookup logs only the SQLSTATE and throws a generic error", async () => {
    vi.mocked(getPoolDb).mockReturnValueOnce(failingDb);
    const error = await lookupInvitation("Maya Santos").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("RSVP lookup failed");
    expect((error as Error).cause).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[rsvp] lookup failed", { code: "57P01" });
  });

  it("submit logs only the SQLSTATE and returns a generic message", async () => {
    vi.mocked(getPoolDb).mockReturnValueOnce(failingDb);
    expect(await submitRsvp(replyForA())).toEqual({
      ok: false,
      error: expect.stringMatching(/try again/),
    });
    expect(console.error).toHaveBeenCalledWith("[rsvp] submit failed", { code: "57P01" });
  });
});

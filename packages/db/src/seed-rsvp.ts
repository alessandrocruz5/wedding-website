import { pathToFileURL } from "node:url";
import { createEnv } from "@ww/env";
import { and, eq, inArray } from "drizzle-orm";
import { createPoolDb } from "./client";
import { migrateEnvSchema } from "./env";
import { guests, invitations, sites } from "./schema";
import { DEMO_SITES } from "./seed";
import type { Database } from "./tenant";

/** The only site this seed may touch. */
const [DEMO_SITE] = DEMO_SITES;

// Fake parties on reserved IDs (suffixes a1/b1 belong to the isolation test fixtures).
// Guest ids derive from the party number + position so the seed stays idempotent.
const id = (prefix: string, n: number) =>
  `${prefix}0000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const PARTIES = [
  { label: "Maya Santos & Leo Park", guests: ["Maya Santos", "Leo Park"] },
  { label: "Priya & Sam Rao", guests: ["Priya Rao", "Sam Rao"] },
  { label: "Noah Fischer & Ines Duarte", guests: ["Noah Fischer", "Ines Duarte"] },
  { label: "Tess & Omar Haddad", guests: ["Tess Haddad", "Omar Haddad"] },
  {
    label: "The Okafor family",
    guests: ["Chidi Okafor", "Amara Okafor", "Kelechi Okafor", "Zuri Okafor"],
  },
  {
    label: "The Lindqvist family",
    guests: ["Erik Lindqvist", "Sofia Lindqvist", "Ava Lindqvist"],
  },
  { label: "Jun Tanaka + 1", guests: ["Jun Tanaka", "Guest of Jun Tanaka"] },
  { label: "Rosa Mendez", guests: ["Rosa Mendez"] },
].map((party, i) => ({
  id: id("1a7e", 0x100 + i),
  label: party.label,
  guests: party.guests.map((fullName, j) => ({
    id: id("9e57", (0x100 + i) * 0x100 + j),
    fullName,
    sortOrder: j,
  })),
}));

export const DEMO_RSVP_PARTY_IDS: readonly string[] = PARTIES.map((p) => p.id);

/** Throws unless a demo-data run was explicitly opted into outside production. */
export function assertSeedAllowed(nodeEnv: string | undefined, allow: string | undefined): void {
  if (nodeEnv === "production" || allow !== "1") {
    throw new Error(
      "Refusing to reseed RSVP demo data: set ALLOW_DEMO_SEED=1 and point MIGRATE_DATABASE_URL at the demo database (never with NODE_ENV=production).",
    );
  }
}

/**
 * Wipes and reloads the demo parties on `ana-and-ben` (replies go with them: the FK cascades).
 * Idempotent; leaves every other site, and the test-fixture parties, alone.
 * Must run as the owner role (bypasses RLS) after `seedDemo`.
 */
export async function seedRsvp(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const [site] = await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, DEMO_SITE.id));
    if (!site) throw new Error(`Demo site ${DEMO_SITE.slug} not found: run db:seed first.`);

    await tx
      .delete(invitations)
      .where(
        and(
          eq(invitations.siteId, DEMO_SITE.id),
          inArray(invitations.id, [...DEMO_RSVP_PARTY_IDS]),
        ),
      );
    await tx
      .insert(invitations)
      .values(PARTIES.map((p) => ({ id: p.id, siteId: DEMO_SITE.id, label: p.label })));
    await tx.insert(guests).values(
      PARTIES.flatMap((p) =>
        p.guests.map((g) => ({
          id: g.id,
          siteId: DEMO_SITE.id,
          invitationId: p.id,
          fullName: g.fullName,
          sortOrder: g.sortOrder,
        })),
      ),
    );
  });
}

async function main() {
  const env = createEnv(migrateEnvSchema);
  assertSeedAllowed(env.NODE_ENV, process.env.ALLOW_DEMO_SEED);
  const db = createPoolDb(env.MIGRATE_DATABASE_URL);
  try {
    await seedRsvp(db);
    console.log(`Reseeded ${PARTIES.length} demo invitations on ${DEMO_SITE.slug}.`);
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

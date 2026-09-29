import { pathToFileURL } from "node:url";
import { createEnv } from "@ww/env";
import { createPoolDb } from "./client";
import { migrateEnvSchema } from "./env";
import { siteDomains, siteMembers, sites, siteTheme, users } from "./schema";
import type { Database } from "./tenant";

// Fixed IDs so the seed is idempotent and tests can reference tenants directly.
export const DEMO_SITES = [
  {
    id: "5a1e0000-0000-4000-8000-000000000001",
    slug: "ana-and-ben",
    name: "Ana & Ben",
    preset: "classic",
    hostnames: ["ana-and-ben.localhost"],
    owner: { id: "05e40000-0000-4000-8000-000000000001", email: "ana@example.com", name: "Ana" },
  },
  {
    id: "5a1e0000-0000-4000-8000-000000000002",
    slug: "carla-and-dan",
    name: "Carla & Dan",
    preset: "garden",
    hostnames: ["carla-and-dan.localhost"],
    owner: {
      id: "05e40000-0000-4000-8000-000000000002",
      email: "carla@example.com",
      name: "Carla",
    },
  },
  {
    id: "5a1e0000-0000-4000-8000-000000000003",
    slug: "eli-and-faye",
    name: "Eli & Faye",
    preset: "modern",
    hostnames: ["eli-and-faye.localhost", "eliandfaye.example.com"],
    owner: { id: "05e40000-0000-4000-8000-000000000003", email: "eli@example.com", name: "Eli" },
  },
] as const;

/** Shared editor on the first two sites: proves users are only visible through membership. */
export const DEMO_PLANNER = {
  id: "05e40000-0000-4000-8000-0000000000aa",
  email: "planner@example.com",
  name: "Demo Planner",
} as const;

/** Idempotent. Must run as the owner role (bypasses RLS). */
export async function seedDemo(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values([...DEMO_SITES.map((s) => s.owner), DEMO_PLANNER])
      .onConflictDoNothing();

    for (const site of DEMO_SITES) {
      await tx
        .insert(sites)
        .values({ id: site.id, slug: site.slug, name: site.name })
        .onConflictDoNothing();
      await tx
        .insert(siteDomains)
        .values(
          site.hostnames.map((hostname, i) => ({ siteId: site.id, hostname, isPrimary: i === 0 })),
        )
        .onConflictDoNothing();
      await tx
        .insert(siteTheme)
        .values({ siteId: site.id, preset: site.preset })
        .onConflictDoNothing();
      await tx
        .insert(siteMembers)
        .values({ siteId: site.id, userId: site.owner.id, role: "owner" })
        .onConflictDoNothing();
    }

    await tx
      .insert(siteMembers)
      .values(
        DEMO_SITES.slice(0, 2).map((s) => ({
          siteId: s.id,
          userId: DEMO_PLANNER.id,
          role: "editor" as const,
        })),
      )
      .onConflictDoNothing();
  });
}

async function main() {
  const env = createEnv(migrateEnvSchema);
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to load demo data with NODE_ENV=production.");
  }
  const db = createPoolDb(env.MIGRATE_DATABASE_URL);
  try {
    await seedDemo(db);
    console.log(`Seeded ${DEMO_SITES.length} demo sites.`);
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

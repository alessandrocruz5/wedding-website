import { neon, Pool } from "@neondatabase/serverless";
import { createEnv } from "@ww/env";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import { dbEnvSchema } from "./env";
import * as schema from "./schema";

/** HTTP driver: one-shot, context-free reads (e.g. site resolution). No transactions. */
export function createHttpDb(url: string) {
  return drizzleHttp(neon(url), { schema });
}

/**
 * WebSocket pool: required for withSite() and anything else needing a transaction.
 * Node runtime only: a module-level pool must not be shared across Edge requests.
 */
export function createPoolDb(url: string) {
  const pool = new Pool({ connectionString: url });
  // Idle clients get dropped (compute restart / scale-to-zero); unhandled, that crashes Node.
  pool.on("error", (error: Error) => console.error("[@ww/db] idle pool client error", error));
  return drizzlePool(pool, { schema });
}

export type HttpDb = ReturnType<typeof createHttpDb>;
export type PoolDb = ReturnType<typeof createPoolDb>;

let httpDb: HttpDb | undefined;
let poolDb: PoolDb | undefined;

// Lazy so importing @ww/db never throws in contexts without a database (tests, builds).
export function getHttpDb(): HttpDb {
  return (httpDb ??= createHttpDb(createEnv(dbEnvSchema).DATABASE_URL));
}

export function getPoolDb(): PoolDb {
  return (poolDb ??= createPoolDb(createEnv(dbEnvSchema).DATABASE_URL));
}

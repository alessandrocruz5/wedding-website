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

/** WebSocket pool: required for withSite() and anything else needing a transaction. */
export function createPoolDb(url: string) {
  return drizzlePool(new Pool({ connectionString: url }), { schema });
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

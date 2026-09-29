import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import type * as schema from "./schema";

/** Any Drizzle Postgres database built with this package's schema (Neon pool, PGlite, ...). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type SiteTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface ResolvedSite {
  id: string;
  slug: string;
}

const siteIdSchema = z.uuid();

/**
 * Run `fn` in a transaction scoped to one tenant. RLS policies read the
 * transaction-local `app.site_id`, so the context cannot outlive the transaction
 * or leak across pooled connections. Needs a transaction-capable driver (pool, not HTTP).
 * Nesting with the same site is allowed; switching to another site inside a running
 * withSite throws, since a savepoint's set_config would outlive it and re-scope the outer tx.
 */
export async function withSite<T>(
  db: Database,
  siteId: string,
  fn: (tx: SiteTx) => Promise<T>,
): Promise<T> {
  if (!siteIdSchema.safeParse(siteId).success) {
    throw new TypeError(`withSite: siteId must be a UUID, got ${JSON.stringify(siteId)}`);
  }
  return db.transaction(async (tx) => {
    const current = (await tx.execute(
      sql`select coalesce(current_setting('app.site_id', true), '') as site_id`,
    )) as unknown as { rows: { site_id: string }[] };
    const active = current.rows[0]?.site_id ?? "";
    if (active !== "" && active.toLowerCase() !== siteId.toLowerCase()) {
      throw new Error(`withSite: transaction is already scoped to site ${active}`);
    }
    await tx.execute(sql`select set_config('app.site_id', ${siteId}, true)`);
    return fn(tx);
  });
}

// Every supported driver returns `{ rows }` from execute(); Drizzle's generic type can't express it.
async function firstRow(db: Database, query: ReturnType<typeof sql>): Promise<ResolvedSite | null> {
  const result = (await db.execute(query)) as unknown as { rows: ResolvedSite[] };
  return result.rows[0] ?? null;
}

/** Hostname -> site, before any tenant context exists (SECURITY DEFINER; exposes id + slug only). */
export function resolveSiteByHost(db: Database, hostname: string): Promise<ResolvedSite | null> {
  return firstRow(db, sql`select id, slug from public.ww_resolve_site_by_host(${hostname})`);
}

/** Slug -> site; used by subdomain routing and the SINGLE_TENANT_SLUG pin. */
export function resolveSiteBySlug(db: Database, slug: string): Promise<ResolvedSite | null> {
  return firstRow(db, sql`select id, slug from public.ww_resolve_site_by_slug(${slug})`);
}

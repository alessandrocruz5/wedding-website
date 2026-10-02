import "server-only";
import {
  getHttpDb,
  getPoolDb,
  resolveSiteByHost,
  resolveSiteBySlug,
  type ResolvedSite,
  sites,
  siteTheme,
  withSite,
} from "@ww/db";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";
import { siteBasePath, siteLookups } from "./resolve-host";
import { getTenantConfig } from "./tenant-context";

export interface Site {
  id: string;
  slug: string;
  name: string;
  theme: { preset: string; tokens: Record<string, string> };
}

/** Cache tag for every site/theme load; Sprint 4's editor revalidates it on write. */
export const SITE_CACHE_TAG = "ww-site";
const REVALIDATE_SECONDS = 300;

async function resolve(key: string): Promise<ResolvedSite | null> {
  const lookups = siteLookups(key, getTenantConfig().rootDomain);
  if (!lookups) return null;
  const db = getHttpDb();
  for (const lookup of lookups) {
    const site =
      lookup.by === "host"
        ? await resolveSiteByHost(db, lookup.hostname)
        : await resolveSiteBySlug(db, lookup.slug);
    if (site) return site;
  }
  return null;
}

async function loadSite(key: string): Promise<Site | null> {
  const resolved = await resolve(key);
  if (!resolved) return null;
  // sites + site_theme are under RLS: read them inside the tenant's context.
  return withSite(getPoolDb(), resolved.id, async (tx) => {
    const [row] = await tx
      .select({ name: sites.name, preset: siteTheme.preset, tokens: siteTheme.tokens })
      .from(sites)
      .leftJoin(siteTheme, eq(siteTheme.siteId, sites.id))
      .where(eq(sites.id, resolved.id));
    if (!row) return null;
    return {
      id: resolved.id,
      slug: resolved.slug,
      name: row.name,
      theme: { preset: row.preset ?? "default", tokens: row.tokens ?? {} },
    };
  });
}

const loadSiteCached = unstable_cache(loadSite, ["ww-site-by-key"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [SITE_CACHE_TAG],
});

/** Site + theme for a middleware site key. Deduped per request, cached across requests. */
export const getSite = cache((key: string): Promise<Site | null> => loadSiteCached(key));

export interface SitePageProps {
  params: Promise<{ siteKey: string }>;
}

/** Page-side load: the site (404 if unknown) and the prefix its own links need. */
export async function requireSite(params: SitePageProps["params"]) {
  const key = (await params).siteKey;
  const site = await getSite(key);
  if (!site) notFound();
  return { site, base: siteBasePath(key, getTenantConfig()) };
}

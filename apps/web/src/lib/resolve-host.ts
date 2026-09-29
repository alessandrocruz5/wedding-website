/**
 * Pure tenant routing, shared by middleware (Edge, no DB) and the site layout (Node, DB).
 *
 * Precedence: SINGLE_TENANT_SLUG pin → custom domain → subdomain of ROOT_DOMAIN → /s/{slug}
 * on a platform host. Middleware can't tell a custom domain from a subdomain without the DB,
 * so it forwards the host as a site key and the layout tries the lookups in order.
 */

/** Same shape as the `sites_slug_format` check in @ww/db. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** App-router folder that site pages live under; only middleware may route into it. */
export const SITES_SEGMENT = "sites";
/** Path prefix for slug routing on the platform host (`/s/{slug}/…`). */
export const PATH_PREFIX = "s";
/** Unroutable target: rendering it yields the app's 404. */
export const NOT_FOUND_PATH = "/__ww/not-found";

export interface TenantConfig {
  /** Pins every request to one site (single-client deploys). */
  singleTenantSlug?: string;
  /** Platform apex, e.g. `localhost` or `weddings.example`. Its subdomains are site slugs. */
  rootDomain: string;
}

/**
 * The URL segment the site layout receives: `s.{slug}` or `h.{hostname}`. Both alphabets are
 * `[a-z0-9.-]`, so the key is path-safe and doubles as the ISR cache key.
 */
export type SiteKey = `s.${string}` | `h.${string}`;

/**
 * Host header → bare lowercase hostname: drops the port and a trailing dot, rejects anything
 * that isn't a valid DNS name or IP. WW-5's resolvers lowercase but do not strip either.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  let h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end > 1 ? h.slice(0, end + 1) : null;
  }
  const colon = h.indexOf(":");
  if (colon !== -1) {
    if (!/^\d+$/.test(h.slice(colon + 1))) return null;
    h = h.slice(0, colon);
  }
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (h.length === 0 || h.length > 253) return null;
  return h.split(".").every((label) => LABEL_PATTERN.test(label)) ? h : null;
}

function isIp(hostname: string): boolean {
  return hostname.startsWith("[") || IPV4_PATTERN.test(hostname);
}

/** Hosts that serve the platform itself (and `/s/{slug}`), never a single site. */
export function isPlatformHost(hostname: string, rootDomain: string): boolean {
  return hostname === rootDomain || hostname === `www.${rootDomain}` || isIp(hostname);
}

/** `{slug}.{rootDomain}` → slug; anything deeper, shallower or malformed → null. */
export function subdomainSlug(hostname: string, rootDomain: string): string | null {
  const suffix = `.${rootDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  return label !== "www" && SLUG_PATTERN.test(label) ? label : null;
}

export type RouteDecision =
  /** Serve `path` (the internal `/sites/{key}/…` route) for this site. */
  | { kind: "site"; key: SiteKey; path: string }
  /** Not a tenant request (platform host): let Next route it normally. */
  | { kind: "pass" }
  /** Would reach the internal sites route directly: answer 404. */
  | { kind: "block" };

function sitePath(key: SiteKey, rest: string): string {
  return `/${SITES_SEGMENT}/${key}${rest === "/" ? "" : rest}`;
}

/** Middleware's whole decision, as a pure function of host, path and config. */
export function decideRoute(
  host: string | null | undefined,
  pathname: string,
  config: TenantConfig,
): RouteDecision {
  if (config.singleTenantSlug) {
    return {
      kind: "site",
      key: `s.${config.singleTenantSlug}`,
      path: sitePath(`s.${config.singleTenantSlug}`, pathname),
    };
  }

  const hostname = normalizeHost(host);
  if (!hostname) return { kind: "block" };

  if (!isPlatformHost(hostname, config.rootDomain)) {
    // Custom domain or subdomain; the layout checks them in that order.
    const key: SiteKey = `h.${hostname}`;
    return { kind: "site", key, path: sitePath(key, pathname) };
  }

  const [, first, slug, ...rest] = pathname.split("/");
  if (first === PATH_PREFIX && slug !== undefined && SLUG_PATTERN.test(slug)) {
    const key: SiteKey = `s.${slug}`;
    return { kind: "site", key, path: sitePath(key, rest.length ? `/${rest.join("/")}` : "/") };
  }
  if (first === SITES_SEGMENT || first === PATH_PREFIX) return { kind: "block" };
  return { kind: "pass" };
}

export type SiteLookup = { by: "host"; hostname: string } | { by: "slug"; slug: string };

/**
 * The layout's side of the key: the DB lookups to try, in precedence order. Null means the key
 * wasn't produced by `decideRoute` and must 404 without touching the DB.
 */
export function siteLookups(key: string, rootDomain: string): SiteLookup[] | null {
  const value = key.slice(2);
  if (key.startsWith("s.")) return SLUG_PATTERN.test(value) ? [{ by: "slug", slug: value }] : null;
  if (!key.startsWith("h.")) return null;
  const hostname = normalizeHost(value);
  if (hostname !== value || isPlatformHost(hostname, rootDomain)) return null;
  const slug = subdomainSlug(hostname, rootDomain);
  return slug
    ? [
        { by: "host", hostname },
        { by: "slug", slug },
      ]
    : [{ by: "host", hostname }];
}

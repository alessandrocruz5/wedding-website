import { baseEnvSchema, createEnv } from "@ww/env";
import { z } from "zod";
import { SLUG_PATTERN, type TenantConfig } from "./resolve-host";

/** Request header middleware sets to the site key; downstream code must not trust a client's. */
export const SITE_HEADER = "x-ww-site";

/** Routing env: Edge-safe (no DB). The DB URL is validated separately, where it's used. */
export const tenantEnvSchema = baseEnvSchema.extend({
  SINGLE_TENANT_SLUG: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().regex(SLUG_PATTERN, "must be a site slug").optional(),
  ),
  /** Platform host serves this site at `/` instead of the landing page; turns SHOWCASE_MODE off. */
  DEFAULT_SITE_SLUG: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().regex(SLUG_PATTERN, "must be a site slug").optional(),
  ),
  ROOT_DOMAIN: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+$/, "must be a bare hostname (no scheme or port)")
    .default("localhost"),
  /** `1` shows the demo banner on every tenant site (the portfolio deploy only). */
  SHOWCASE_MODE: z.enum(["0", "1"]).optional(),
});

let config: TenantConfig | undefined;

/** Parsed once per isolate; a malformed pin fails loudly instead of silently going multi-tenant. */
export function getTenantConfig(): TenantConfig {
  if (!config) {
    const env = createEnv(tenantEnvSchema);
    config = {
      singleTenantSlug: env.SINGLE_TENANT_SLUG,
      defaultSiteSlug: env.DEFAULT_SITE_SLUG,
      rootDomain: env.ROOT_DOMAIN,
    };
  }
  return config;
}

/** Demo banner state: off unless `SHOWCASE_MODE=1`, and always off in default-site mode; `landingHref` is the platform landing page. */
export function getShowcase(): { enabled: boolean; landingHref: string } {
  const env = createEnv(tenantEnvSchema);
  const { rootDomain } = getTenantConfig();
  return {
    enabled: env.SHOWCASE_MODE === "1" && !env.DEFAULT_SITE_SLUG,
    // Subdomain sites need an absolute link to the apex; locally there is no real apex.
    landingHref: rootDomain === "localhost" ? "/" : `https://${rootDomain}/`,
  };
}

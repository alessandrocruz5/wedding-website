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
  ROOT_DOMAIN: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+$/, "must be a bare hostname (no scheme or port)")
    .default("localhost"),
});

let config: TenantConfig | undefined;

/** Parsed once per isolate; a malformed pin fails loudly instead of silently going multi-tenant. */
export function getTenantConfig(): TenantConfig {
  if (!config) {
    const env = createEnv(tenantEnvSchema);
    config = { singleTenantSlug: env.SINGLE_TENANT_SLUG, rootDomain: env.ROOT_DOMAIN };
  }
  return config;
}

import type { MetadataRoute } from "next";
import { platformOrigin } from "../src/lib/resolve-host";
import { getTenantConfig } from "../src/lib/tenant-context";
import { DEMOS } from "../src/content/demos";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = platformOrigin(getTenantConfig().rootDomain);
  return [origin, ...DEMOS.map((d) => `${origin}/s/${d.slug}`)].map((url) => ({ url }));
}

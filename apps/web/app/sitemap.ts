import type { MetadataRoute } from "next";
import { platformOrigin } from "../src/lib/resolve-host";
import { getTenantConfig } from "../src/lib/tenant-context";
import { DEMOS } from "../src/content/demos";

export default function sitemap(): MetadataRoute.Sitemap {
  const { rootDomain, defaultSiteSlug } = getTenantConfig();
  const origin = platformOrigin(rootDomain);
  if (defaultSiteSlug) {
    return ["", "/schedule", "/travel", "/rsvp"].map((path) => ({ url: `${origin}${path}` }));
  }
  return [origin, ...DEMOS.map((d) => `${origin}/s/${d.slug}`)].map((url) => ({ url }));
}

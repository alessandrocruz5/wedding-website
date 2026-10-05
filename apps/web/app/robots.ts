import type { MetadataRoute } from "next";
import { platformOrigin } from "../src/lib/resolve-host";
import { getTenantConfig } from "../src/lib/tenant-context";

// Read env per request, never at build time (ROOT_DOMAIN is unset during `next build`).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${platformOrigin(getTenantConfig().rootDomain)}/sitemap.xml`,
  };
}

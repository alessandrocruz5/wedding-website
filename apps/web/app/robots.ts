import type { MetadataRoute } from "next";
import { platformOrigin } from "../src/lib/resolve-host";
import { getTenantConfig } from "../src/lib/tenant-context";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${platformOrigin(getTenantConfig().rootDomain)}/sitemap.xml`,
  };
}

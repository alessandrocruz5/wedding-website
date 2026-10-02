import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not builds.
  transpilePackages: ["@ww/db", "@ww/env", "@ww/ui"],
  // @ww/ui's barrel re-exports client components (the RSVP form); without this every page that
  // imports anything from it would ship them.
  experimental: { optimizePackageImports: ["@ww/ui"] },
  // Lint runs through turbo with the shared flat config.
  eslint: { ignoreDuringBuilds: true },
  // Site pages take their CDN caching from ISR (`revalidate`), so only API routes are set here.
  // A header set here overrides the route's own: API responses are never shared-cached, and a
  // route that should be cacheable needs an explicit exception in this list.
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;

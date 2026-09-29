import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not builds.
  transpilePackages: ["@ww/db", "@ww/env", "@ww/ui"],
  // Lint runs through turbo with the shared flat config.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

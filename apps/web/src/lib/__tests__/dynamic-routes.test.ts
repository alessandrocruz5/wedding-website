import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// These routes resolve their origin from env; if pre-rendered they bake in build-time (localhost)
// values. Source is read as text because vitest has no JSX transform for app/page.tsx.
const appDir = resolve(__dirname, "../../../app");

describe("env-dependent routes", () => {
  it.each(["page.tsx", "robots.ts", "sitemap.ts"])(
    "app/%s opts out of static rendering",
    (file) => {
      const source = readFileSync(resolve(appDir, file), "utf8");
      expect(source).toMatch(/^export const dynamic = "force-dynamic";$/m);
    },
  );
});

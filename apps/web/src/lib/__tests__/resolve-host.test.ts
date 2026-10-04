import { createEnv, EnvValidationError } from "@ww/env";
import { describe, expect, it } from "vitest";
import { config as middlewareConfig } from "../../../middleware";
import {
  decideRoute,
  normalizeHost,
  platformOrigin,
  siteBasePath,
  siteLookups,
  subdomainSlug,
  type TenantConfig,
} from "../resolve-host";
import { tenantEnvSchema } from "../tenant-context";

const multi: TenantConfig = { rootDomain: "weddings.test" };
const pinned: TenantConfig = { rootDomain: "weddings.test", singleTenantSlug: "carla-and-dan" };

describe("normalizeHost", () => {
  it.each([
    ["Ana-And-Ben.Weddings.Test", "ana-and-ben.weddings.test"],
    ["ana-and-ben.localhost:3000", "ana-and-ben.localhost"],
    ["eliandfaye.example.com.", "eliandfaye.example.com"],
    ["eliandfaye.example.com.:443", "eliandfaye.example.com"],
    ["127.0.0.1:3000", "127.0.0.1"],
    ["[::1]:3000", "[::1]"],
    ["  localhost  ", "localhost"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    ":3000",
    "a..b",
    "-bad.test",
    "bad-.test",
    "a_b.test",
    "evil.test:80x",
    "a b.test",
    "a/b.test",
    "[::1",
  ])("rejects %j", (input) => {
    expect(normalizeHost(input)).toBeNull();
  });

  it("rejects hostnames longer than 253 characters", () => {
    expect(normalizeHost(`${"a".repeat(63)}.`.repeat(4) + "test")).toBeNull();
  });
});

describe("subdomainSlug", () => {
  it("returns the single label under the root domain", () => {
    expect(subdomainSlug("ana-and-ben.weddings.test", "weddings.test")).toBe("ana-and-ben");
  });

  it.each([
    "weddings.test",
    "www.weddings.test",
    "a.b.weddings.test",
    "ana.otherweddings.test",
    "ana.example.com",
  ])("is null for %s", (host) => {
    expect(subdomainSlug(host, "weddings.test")).toBeNull();
  });
});

describe("decideRoute — precedence", () => {
  it("1. SINGLE_TENANT_SLUG pins every host and path to one site", () => {
    for (const host of [
      "eliandfaye.example.com",
      "ana-and-ben.weddings.test",
      "weddings.test",
      "anything.vercel.app",
      null,
    ]) {
      expect(decideRoute(host, "/", pinned)).toEqual({
        kind: "site",
        key: "s.carla-and-dan",
        path: "/sites/s.carla-and-dan",
      });
    }
  });

  it("1. a pin keeps the path and ignores /s/{slug} (no tenant switching)", () => {
    expect(decideRoute("weddings.test", "/s/ana-and-ben", pinned)).toEqual({
      kind: "site",
      key: "s.carla-and-dan",
      path: "/sites/s.carla-and-dan/s/ana-and-ben",
    });
  });

  it("2/3. a non-platform host becomes a host key (layout: custom domain, then subdomain)", () => {
    expect(decideRoute("EliAndFaye.example.com:443", "/", multi)).toEqual({
      kind: "site",
      key: "h.eliandfaye.example.com",
      path: "/sites/h.eliandfaye.example.com",
    });
    expect(decideRoute("ana-and-ben.weddings.test", "/story", multi)).toEqual({
      kind: "site",
      key: "h.ana-and-ben.weddings.test",
      path: "/sites/h.ana-and-ben.weddings.test/story",
    });
  });

  it("2/3. /s/{slug} on a site's own host is just a path on that site", () => {
    expect(decideRoute("ana-and-ben.weddings.test", "/s/eli-and-faye", multi)).toMatchObject({
      key: "h.ana-and-ben.weddings.test",
    });
  });

  it.each(["weddings.test", "www.weddings.test", "127.0.0.1:3000", "[::1]:3000"])(
    "4. /s/{slug} routes by slug on platform host %s",
    (host) => {
      expect(decideRoute(host, "/s/ana-and-ben", multi)).toEqual({
        kind: "site",
        key: "s.ana-and-ben",
        path: "/sites/s.ana-and-ben",
      });
      expect(decideRoute(host, "/s/ana-and-ben/rsvp/form", multi)).toMatchObject({
        path: "/sites/s.ana-and-ben/rsvp/form",
      });
    },
  );

  it("4. the platform's own paths pass through", () => {
    expect(decideRoute("weddings.test", "/", multi)).toEqual({ kind: "pass" });
    expect(decideRoute("weddings.test", "/about", multi)).toEqual({ kind: "pass" });
  });
});

describe("decideRoute — the internal route is unreachable directly", () => {
  it.each([
    "/sites/s.ana-and-ben",
    "/sites/h.eliandfaye.example.com",
    "/sites",
    "/s/",
    "/s/Ana",
    "/s/-x",
    "/s/a..b",
  ])("blocks %s on the platform host", (path) => {
    expect(decideRoute("weddings.test", path, multi)).toEqual({ kind: "block" });
  });

  it("nests /sites/… under the host's own site on a tenant host", () => {
    expect(decideRoute("ana-and-ben.weddings.test", "/sites/s.eli-and-faye", multi)).toMatchObject({
      path: "/sites/h.ana-and-ben.weddings.test/sites/s.eli-and-faye",
    });
  });

  it("nests /sites/… under the pinned site in single-tenant mode", () => {
    expect(decideRoute("weddings.test", "/sites/s.ana-and-ben", pinned)).toMatchObject({
      path: "/sites/s.carla-and-dan/sites/s.ana-and-ben",
    });
  });

  it("blocks a missing or malformed Host header", () => {
    expect(decideRoute(null, "/", multi)).toEqual({ kind: "block" });
    expect(decideRoute("evil.test/../x", "/", multi)).toEqual({ kind: "block" });
  });
});

describe("siteLookups", () => {
  it("slug key → one slug lookup", () => {
    expect(siteLookups("s.ana-and-ben", "weddings.test")).toEqual([
      { by: "slug", slug: "ana-and-ben" },
    ]);
  });

  it("subdomain host → custom-domain lookup first, then the subdomain slug", () => {
    expect(siteLookups("h.ana-and-ben.weddings.test", "weddings.test")).toEqual([
      { by: "host", hostname: "ana-and-ben.weddings.test" },
      { by: "slug", slug: "ana-and-ben" },
    ]);
  });

  it("custom domain → host lookup only", () => {
    expect(siteLookups("h.eliandfaye.example.com", "weddings.test")).toEqual([
      { by: "host", hostname: "eliandfaye.example.com" },
    ]);
  });

  it.each([
    "ana-and-ben",
    "x.ana-and-ben",
    "s.",
    "s.Ana",
    "s.ana/../eli",
    "h.",
    "h.Ana.weddings.test",
    "h.weddings.test",
    "h.www.weddings.test",
    "h.127.0.0.1",
    "h.eliandfaye.example.com:443",
  ])("rejects forged or non-canonical key %j", (key) => {
    expect(siteLookups(key, "weddings.test")).toBeNull();
  });

  it("round-trips every key decideRoute emits", () => {
    for (const host of ["ana-and-ben.weddings.test", "eliandfaye.example.com"]) {
      const d = decideRoute(host, "/", multi);
      if (d.kind !== "site") throw new Error("expected a site route");
      expect(siteLookups(d.key, multi.rootDomain)).not.toBeNull();
    }
  });
});

describe("siteBasePath", () => {
  it("keeps the /s/{slug} prefix for slug routing on the platform host", () => {
    expect(siteBasePath("s.ana-and-ben", multi)).toBe("/s/ana-and-ben");
  });

  it("serves hosts and pinned deploys at the root", () => {
    expect(siteBasePath("h.ana-and-ben.weddings.test", multi)).toBe("");
    expect(siteBasePath("h.eliandfaye.example.com", multi)).toBe("");
    expect(siteBasePath("s.carla-and-dan", pinned)).toBe("");
  });

  it.each([
    ["weddings.test", "/s/ana-and-ben", multi],
    ["ana-and-ben.weddings.test", "/", multi],
    ["eliandfaye.example.com", "/", multi],
    ["anything.example", "/", pinned],
  ] as const)("links from %s%s route back to the same site", (host, path, config) => {
    const home = decideRoute(host, path, config);
    if (home.kind !== "site") throw new Error("expected a site route");
    const link = `${siteBasePath(home.key, config)}/schedule`;
    expect(decideRoute(host, link, config)).toEqual({
      kind: "site",
      key: home.key,
      path: `/sites/${home.key}/schedule`,
    });
  });
});

describe("tenantEnvSchema", () => {
  it("defaults to multi-tenant on localhost", () => {
    const env = createEnv(tenantEnvSchema, {});
    expect(env.ROOT_DOMAIN).toBe("localhost");
    expect(env.SINGLE_TENANT_SLUG).toBeUndefined();
  });

  it("treats an empty pin as unset", () => {
    expect(
      createEnv(tenantEnvSchema, { SINGLE_TENANT_SLUG: "" }).SINGLE_TENANT_SLUG,
    ).toBeUndefined();
  });

  it("fails fast on a malformed pin rather than silently serving every tenant", () => {
    expect(() => createEnv(tenantEnvSchema, { SINGLE_TENANT_SLUG: "Ana & Ben" })).toThrow(
      EnvValidationError,
    );
  });

  it("rejects a ROOT_DOMAIN with a scheme or port", () => {
    expect(() => createEnv(tenantEnvSchema, { ROOT_DOMAIN: "https://weddings.test" })).toThrow(
      EnvValidationError,
    );
    expect(() => createEnv(tenantEnvSchema, { ROOT_DOMAIN: "weddings.test:3000" })).toThrow(
      EnvValidationError,
    );
  });
});

describe("landing page routing", () => {
  it("passes `/` on the platform host (and www) to the landing page", () => {
    expect(decideRoute("weddings.test", "/", multi)).toEqual({ kind: "pass" });
    expect(decideRoute("www.weddings.test:3000", "/", multi)).toEqual({ kind: "pass" });
  });

  it("serves the site at `/` on tenant hosts", () => {
    expect(decideRoute("ana-and-ben.weddings.test", "/", multi)).toEqual({
      kind: "site",
      key: "h.ana-and-ben.weddings.test",
      path: "/sites/h.ana-and-ben.weddings.test",
    });
    expect(decideRoute("eliandfaye.example.com", "/", multi).kind).toBe("site");
  });

  it("serves the pinned site at `/`, even on the platform host", () => {
    expect(decideRoute("weddings.test", "/", pinned)).toEqual({
      kind: "site",
      key: "s.carla-and-dan",
      path: "/sites/s.carla-and-dan",
    });
  });
});

describe("middleware matcher", () => {
  const [source] = middlewareConfig.matcher;
  // Next compiles the matcher with path-to-regexp; this source is plain regex after the slash.
  const matcher = new RegExp(`^${source}$`);
  const runs = (path: string) => matcher.test(path);

  it.each([
    "/api/health",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/icon.svg",
    "/opengraph-image",
    "/opengraph-image-1a2b3c",
    "/opengraph-image.png",
    "/robots.txt",
    "/sitemap.xml",
  ])("skips %s, so it is not rewritten into a tenant route", (path) => {
    expect(runs(path)).toBe(false);
  });

  it.each([
    "/",
    "/s/ana-and-ben",
    "/rsvp",
    "/sites/s.ana-and-ben",
    "/our-icon.svg",
    "/gallery/icon.svg",
  ])("still runs for %s", (path) => {
    expect(runs(path)).toBe(true);
  });
});

describe("platformOrigin", () => {
  it("is http on localhost and https elsewhere", () => {
    expect(platformOrigin("localhost")).toBe("http://localhost:3000");
    expect(platformOrigin("ww.vercel.app")).toBe("https://ww.vercel.app");
  });
});

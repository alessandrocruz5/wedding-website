import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";
import { BRAND_TOKENS, PRESETS, SURFACE_TOKENS, TOKEN_NAMES } from "../token-contract";

const srcDir = fileURLToPath(new URL("../", import.meta.url));
const tokensCss = readFileSync(`${srcDir}tokens.css`, "utf8");
const presetCss = readFileSync(`${srcDir}styles/preset.css`, "utf8");

/** Body of the first rule whose selector list starts with `selectorStart`. */
function ruleBody(css: string, selectorStart: string): string {
  const at = css.indexOf(selectorStart);
  if (at === -1) throw new Error(`rule not found: ${selectorStart}`);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

function declared(body: string): string[] {
  return [...body.matchAll(/--ww-([\w-]+)\s*:/g)].map((m) => m[1] ?? "");
}

describe("token contract", () => {
  it("has no duplicate or overlapping names", () => {
    expect(new Set(TOKEN_NAMES).size).toBe(TOKEN_NAMES.length);
    expect(SURFACE_TOKENS.filter((t) => (BRAND_TOKENS as readonly string[]).includes(t))).toEqual(
      [],
    );
  });

  it("defines exactly the contract in the light defaults", () => {
    expect(declared(ruleBody(tokensCss, ":root,")).sort()).toEqual([...TOKEN_NAMES].sort());
  });

  it("flips exactly the surface tokens in both dark blocks", () => {
    const forced = ruleBody(tokensCss, ':root:has([data-ww-mode="dark"])');
    const system = ruleBody(tokensCss, ':root:not(:has([data-ww-mode="light"]))');
    expect(declared(forced).sort()).toEqual([...SURFACE_TOKENS].sort());
    const normalize = (body: string) => body.replace(/\s+/g, " ").trim();
    expect(normalize(forced)).toBe(normalize(system));
  });

  it("presets override brand tokens only", () => {
    for (const preset of PRESETS.filter((p) => p !== "default")) {
      const names = declared(ruleBody(tokensCss, `[data-ww-preset="${preset}"]`));
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(BRAND_TOKENS).toContain(name);
    }
  });

  it("maps every color and font token into the Tailwind theme", () => {
    const theme = ruleBody(presetCss, "@theme inline {");
    for (const name of TOKEN_NAMES.filter((t) => t !== "radius")) {
      expect(theme).toContain(`--${name}: var(--ww-${name});`);
    }
    expect(theme).toContain("--radius-md: var(--ww-radius);");
  });
});

/** WCAG relative luminance of an sRGB colour given as linear channels. */
function luminance([r, g, b]: number[]): number {
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

function hexToLinear(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

/** `oklch(L C H)` → linear sRGB, clamped to gamut. */
function oklchToLinear(value: string): number[] {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (!m) throw new Error(`not an oklch() value: ${value}`);
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

function tokenValue(body: string, name: string): string | undefined {
  return new RegExp(`--ww-${name}\\s*:\\s*([^;]+?)\\s*(?:/\\*.*?\\*/)?;`).exec(body)?.[1];
}

describe("preset contrast (WCAG AA)", () => {
  const rootBody = ruleBody(tokensCss, ":root,");
  const designCss = readFileSync(`${srcDir}styles/design.css`, "utf8");
  const clayLight = hexToLinear(/--color-clay-light:\s*(#[0-9a-f]{6})/i.exec(designCss)?.[1] ?? "");

  for (const preset of PRESETS.filter((p) => p !== "default")) {
    it(`${preset}: text and the inverse eyebrow clear 4.5:1`, () => {
      const body = ruleBody(tokensCss, `[data-ww-preset="${preset}"]`);
      const pick = (name: string) => tokenValue(body, name) ?? tokenValue(rootBody, name) ?? "";
      const toLinear = (v: string) => (v.startsWith("#") ? hexToLinear(v) : oklchToLinear(v));
      const primary = toLinear(pick("color-primary"));
      const accent = toLinear(pick("color-accent"));
      const accentFg = toLinear(pick("color-accent-foreground"));
      const primaryFg = toLinear(pick("color-primary-foreground"));
      const background = toLinear(pick("color-background"));

      expect(contrast(primary, primaryFg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(primary, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, accentFg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, clayLight)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the three demo presets differ in primary and accent", () => {
    const seen = new Set<string>();
    for (const preset of ["classic", "garden", "modern"]) {
      const body = ruleBody(tokensCss, `[data-ww-preset="${preset}"]`);
      seen.add(tokenValue(body, "color-primary") ?? "");
      seen.add(tokenValue(body, "color-accent") ?? "");
    }
    expect(seen.size).toBe(6);
  });
});

describe("tailwind preset", () => {
  it("compiles utilities that read the live --ww-* variables", async () => {
    const compiler = await compile(`@import "tailwindcss";\n@import "@ww/ui/preset.css";`, {
      base: srcDir,
      onDependency: () => {},
    });
    const css = compiler.build([
      "bg-primary",
      "text-muted-foreground",
      "border-input",
      "rounded-md",
      "font-heading",
      "dark:bg-surface",
    ]);

    expect(css).toMatch(/\.bg-primary\s*{\s*background-color: var\(--ww-color-primary\)/);
    expect(css).toMatch(/\.text-muted-foreground\s*{\s*color: var\(--ww-color-muted-foreground\)/);
    expect(css).toMatch(/\.border-input\s*{[^}]*var\(--ww-color-input\)/);
    expect(css).toMatch(/\.rounded-md\s*{\s*border-radius: var\(--ww-radius\)/);
    expect(css).toMatch(/\.font-heading\s*{\s*font-family: var\(--ww-font-heading\)/);
    expect(css).toContain('.dark\\:bg-surface:where([data-ww-mode="dark"]');
    // The token layer ships with the preset, inside a cascade layer.
    expect(css).toMatch(/@layer base\s*{\s*:root,\s*\[data-ww-theme\]/);
    // Workspace components are scanned even though they live under node_modules in the app.
    expect(compiler.sources).toContainEqual(expect.objectContaining({ pattern: ".." }));
  });

  it("ships the design layer: fixed palette plus utilities derived from the contract", async () => {
    const compiler = await compile(`@import "tailwindcss";\n@import "@ww/ui/preset.css";`, {
      base: srcDir,
      onDependency: () => {},
    });
    const css = compiler.build(["bg-calm", "bg-primary-soft", "rounded-card", "rounded-dome"]);

    // Static palette: emitted as variables even when unused, for inline styles.
    expect(css).toMatch(/--color-clay-bright:\s*#b0664a/);
    expect(css).toMatch(/\.bg-calm\s*{\s*background-color: var\(--color-calm\)/);
    // Derived utilities carry the expression, so they follow presets and per-site overrides.
    expect(css).toMatch(/\.bg-primary-soft\s*{[^}]*color-mix\(in oklab, var\(--ww-color-primary\)/);
    expect(css).toMatch(/\.rounded-card\s*{\s*border-radius: calc\(var\(--ww-radius\) \* 1\.75\)/);
    expect(css).toMatch(/\.rounded-dome\s*{\s*border-radius: var\(--radius-dome\)/);
  });
});

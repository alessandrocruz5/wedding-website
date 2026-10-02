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

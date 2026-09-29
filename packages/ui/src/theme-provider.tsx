import type { ReactNode } from "react";
import { SURFACE_TOKENS, TOKEN_NAMES, type TokenName } from "./token-contract";

export type ThemeMode = "light" | "dark" | "system";

/** Per-site overrides as stored in `site_theme.tokens`: `{ "color-primary": "…", "dark:color-background": "…" }`. */
export type ThemeTokens = Readonly<Record<string, unknown>>;

export interface ThemeProviderProps {
  /** `site_theme.preset`. Unknown or malformed names fall back to the default tokens. */
  preset?: string | null;
  /** `site_theme.tokens`. Unknown keys and unsafe values are dropped, never rendered. */
  tokens?: ThemeTokens | null;
  /** Server-decided mode; "system" follows `prefers-color-scheme` with no client script. */
  mode?: ThemeMode;
  children: ReactNode;
}

const TOKEN_SET: ReadonlySet<string> = new Set(TOKEN_NAMES);
const SURFACE_SET: ReadonlySet<string> = new Set(SURFACE_TOKENS);
const DARK_PREFIX = "dark:";
const MAX_VALUE_LENGTH = 200;
const PRESET_PATTERN = /^[a-z0-9-]{1,32}$/;

// No `;{}<>\@!:` — a value can neither end its declaration, open a rule nor leave the <style>.
const VALUE_CHARSET = /^[\w\s#%.,()+\-*/'"]+$/;
// No url()/image()/src(): a site's theme must not be able to load third-party resources.
const ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "var",
  "calc",
  "min",
  "max",
  "clamp",
]);

/** True when `value` is safe to emit verbatim as a custom-property value. */
export function isSafeTokenValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length === 0 || v.length > MAX_VALUE_LENGTH) return false;
  if (!VALUE_CHARSET.test(v) || v.includes("/*") || v.includes("*/")) return false;
  for (const quote of ['"', "'"]) {
    if (v.split(quote).length % 2 === 0) return false;
  }
  let depth = 0;
  for (const ch of v) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  if (depth !== 0) return false;
  for (const [, name] of v.matchAll(/([\w-]*)\(/g)) {
    // A bare "(" (e.g. `calc((a + b) * 2)`) is grouping, not a function call.
    if (name && !ALLOWED_FUNCTIONS.has(name.toLowerCase())) return false;
  }
  return true;
}

type Declarations = [TokenName, string][];

/** Splits overrides into brand (both modes), light-surface and dark declarations. */
function partition(tokens: ThemeTokens) {
  const brand: Declarations = [];
  const light: Declarations = [];
  const dark: Declarations = [];
  for (const [rawKey, value] of Object.entries(tokens)) {
    const isDark = rawKey.startsWith(DARK_PREFIX);
    const key = isDark ? rawKey.slice(DARK_PREFIX.length) : rawKey;
    if (!TOKEN_SET.has(key) || !isSafeTokenValue(value)) continue;
    const decl: [TokenName, string] = [key as TokenName, value.trim()];
    if (isDark) dark.push(decl);
    // An unprefixed surface override is the LIGHT value; it must not leak into dark mode.
    else if (SURFACE_SET.has(key)) light.push(decl);
    else brand.push(decl);
  }
  return { brand, light, dark };
}

function block(selector: string, decls: Declarations): string {
  if (decls.length === 0) return "";
  return `${selector}{${decls.map(([k, v]) => `--ww-${k}:${v}`).join(";")}}`;
}

/**
 * Builds the per-site override stylesheet. Unlayered, so it beats the layered defaults in
 * tokens.css. Returns "" when there is nothing (safe) to override.
 */
export function buildThemeCss(tokens: ThemeTokens | null | undefined): string {
  if (!tokens) return "";
  const { brand, light, dark } = partition(tokens);
  const root = "[data-ww-theme]";
  return [
    block(root, brand),
    block(`${root}[data-ww-mode="light"]`, light),
    light.length
      ? `@media (prefers-color-scheme: light){${block(`${root}:not([data-ww-mode="dark"])`, light)}}`
      : "",
    block(`${root}[data-ww-mode="dark"]`, dark),
    dark.length
      ? `@media (prefers-color-scheme: dark){${block(`${root}:not([data-ww-mode="light"])`, dark)}}`
      : "",
  ].join("");
}

function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Server component. Scopes a site's theme to its subtree and ships the overrides as a
 * React-hoisted <style> in the SSR <head>, so the first paint is already themed (no FOUC,
 * no client JS). Render one per page, around the site's content.
 */
export function ThemeProvider({ preset, tokens, mode = "system", children }: ThemeProviderProps) {
  const css = buildThemeCss(tokens);
  const safePreset = preset && PRESET_PATTERN.test(preset) ? preset : "default";
  return (
    <div data-ww-theme="" data-ww-preset={safePreset} data-ww-mode={mode}>
      {css ? (
        <style href={`ww-theme-${hash(css)}`} precedence="ww-theme">
          {css}
        </style>
      ) : null}
      {children}
    </div>
  );
}

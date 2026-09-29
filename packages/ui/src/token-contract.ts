/**
 * The design-system token contract. Every name here is a CSS custom property `--ww-<name>`
 * defined in `tokens.css` and mapped to Tailwind in `styles/preset.css`. The Claude Design
 * import must supply values for exactly these names; renaming one is a breaking change.
 */

/** Tokens whose value flips between light and dark mode. */
export const SURFACE_TOKENS = [
  "color-background",
  "color-foreground",
  "color-surface",
  "color-surface-foreground",
  "color-muted",
  "color-muted-foreground",
  "color-border",
  "color-input",
] as const;

/** Tokens that carry a site's brand and are identical in both modes. */
export const BRAND_TOKENS = [
  "color-primary",
  "color-primary-foreground",
  "color-accent",
  "color-accent-foreground",
  "color-destructive",
  "color-destructive-foreground",
  "color-ring",
  "font-body",
  "font-heading",
  "radius",
] as const;

export const TOKEN_NAMES = [...SURFACE_TOKENS, ...BRAND_TOKENS] as const;

export type SurfaceToken = (typeof SURFACE_TOKENS)[number];
export type TokenName = (typeof TOKEN_NAMES)[number];

/** Presets shipped in `tokens.css`. Unknown preset names render the default tokens. */
export const PRESETS = ["default", "classic", "garden", "modern"] as const;

export type Preset = (typeof PRESETS)[number];

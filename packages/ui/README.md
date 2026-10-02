# @ww/ui

Theming seam, design-system token contract and the **Arc & Hearth** components (Claude Design
import, WW-3): a Tailwind v4 preset, a CSS-variable token layer, a fixed design layer, a
server-rendered `<ThemeProvider>` for per-site overrides, and the site's components.

## Wiring it into an app

```css
/* app/globals.css — tailwindcss first, then the preset (it pulls in tokens.css) */
@import "tailwindcss";
@import "@ww/ui/preset.css";
```

```tsx
// Site layout (Server Component). One ThemeProvider per page, around the site's content.
import { ThemeProvider } from "@ww/ui";

const theme = await withSite(getPoolDb(), site.id, (tx) => tx.select().from(siteTheme));
return (
  <ThemeProvider preset={theme[0]?.preset} tokens={theme[0]?.tokens}>
    {children}
  </ThemeProvider>
);
```

- Overrides ship as a React 19 hoisted `<style precedence>` in the SSR `<head>`, so the first
  paint is already themed: no FOUC and no client script.
- `mode` is `"system"` by default (`prefers-color-scheme`). Pass `"light"`/`"dark"` to force one,
  also without client JS.
- The package ships TypeScript source (no build step). The consuming Next.js app must list it in
  `transpilePackages: ["@ww/ui"]` and `experimental.optimizePackageImports: ["@ww/ui"]`. Without
  the latter, every page that imports from the barrel ships the client-side RSVP form.
- Fonts: the default `font-body`/`font-heading` read `--font-jost`/`--font-cormorant`, which the
  app defines with `next/font/google` (self-hosted, so guest pages make no Google requests).
- Wedding sites render `mode="light"`: the design has no dark mode, so the dark surface values in
  `tokens.css` are still the WW-6 placeholders.

## The token contract

Every token is a CSS variable `--ww-<name>`. The **names** are the contract that the Claude
Design import must satisfy. The light **values** in `src/tokens.css` are the Arc & Hearth design; presets may change brand tokens. The canonical
list is `TOKEN_NAMES` in `src/token-contract.ts`, and the test suite fails if `tokens.css` or
`preset.css` drift from it.

| Token (`--ww-…`)               | Group   | Tailwind utility                         |
| ------------------------------ | ------- | ---------------------------------------- |
| `color-background`             | surface | `bg-background`                          |
| `color-foreground`             | surface | `text-foreground`                        |
| `color-surface`                | surface | `bg-surface`                             |
| `color-surface-foreground`     | surface | `text-surface-foreground`                |
| `color-muted`                  | surface | `bg-muted`                               |
| `color-muted-foreground`       | surface | `text-muted-foreground`                  |
| `color-border`                 | surface | `border-border`                          |
| `color-input`                  | surface | `border-input`                           |
| `color-primary`                | brand   | `bg-primary`                             |
| `color-primary-foreground`     | brand   | `text-primary-foreground`                |
| `color-accent`                 | brand   | `bg-accent`                              |
| `color-accent-foreground`      | brand   | `text-accent-foreground`                 |
| `color-destructive`            | brand   | `bg-destructive`                         |
| `color-destructive-foreground` | brand   | `text-destructive-foreground`            |
| `color-ring`                   | brand   | `outline-ring` / `ring-ring`             |
| `font-body`                    | brand   | `font-body`                              |
| `font-heading`                 | brand   | `font-heading`                           |
| `radius`                       | brand   | `rounded-sm/md/lg/xl` (×0.5 / 1 / 1.5 / 2) |

- **Surface** tokens flip between light and dark. **Brand** tokens are the same in both modes.
- **Presets** (`default`, `classic`, `garden`, `modern`) override brand tokens only. An unknown
  preset name renders `default`.
- Components use **utilities only**, never raw colors, so every site override reaches them.
  `dark:` works in both forced and system modes.

## Per-site overrides (`site_theme.tokens`)

Keys are token names **without** the `--ww-` prefix. Prefix a key with `dark:` to set its
dark-mode value.

```json
{ "color-primary": "oklch(0.55 0.1 20)", "font-heading": "\"Playfair Display\", serif",
  "color-background": "#fffaf5", "dark:color-background": "#1c1917" }
```

- An unprefixed **brand** override applies in both modes.
- An unprefixed **surface** override applies to **light mode only**. Without a `dark:` pair,
  dark mode keeps the default dark value, so one light tweak never breaks dark mode.
- The admin UI writes these (Sprint 4), so they are treated as untrusted. Unknown keys are
  dropped. A value is dropped unless it passes `isSafeTokenValue`: at most 200 characters, no
  `; { } < > \ @ ! :`, no comments, balanced quotes and parentheses, and only these functions:
  color functions, `color-mix`, `var`, `calc`, `min`, `max` and `clamp`. There is **no `url()`**,
  so a theme can never load third-party resources on a guest page.

## Design layer (`src/styles/design.css`)

The Arc & Hearth extras on top of the contract. They are **not** part of it and cannot be set
through `site_theme.tokens`.

- **Fixed earth palette** (`@theme static`, also available as `--color-*` vars for inline styles):
  `calm`, `calm-strong`, `calm-foreground` (sage bands), `inverse`, `inverse-foreground`,
  `inverse-muted` (bark footer), `ink-soft` (secondary text), `ochre`, `ochre-foreground`,
  `clay-soft`, `clay-light`, `ornament`, `clay-bright`. Also bark-tinted `shadow-sm/md/lg`, the
  type scale (`text-display-xl` … `text-eyebrow`), `tracking-*`, `ease-arc`,
  `max-w-content/text/form`, and the fixed arch shapes `rounded-arch`, `rounded-arch-soft` and
  `rounded-dome`.
- **Derived from the contract** (`@theme inline`, resolved per element so presets and overrides
  reach them): `primary-hover`, `primary-soft`, `focus` (the 4px halo), and `rounded-card`,
  `rounded-panel`, `rounded-check`, `rounded-form` as multiples of `--ww-radius`.

## Components

Server components unless noted. They style themselves only through the utilities above.

- **Core:** `Button` (+ `buttonClasses()` for links), `Badge`, `Card`, `SectionHeading`, `Names`
  (wordmark), and `Accordion` (native exclusive `<details name>`, no JS).
- **Arcs:** `ArchFrame` (image or striped placeholder in arch shapes) and `ArcDivider`.
- **Forms** (client): `Field`, `TextField`, `SelectField`, `ChoiceGroup`, `Checkbox`, `Stepper`.
- **RSVP:** `StepArc`, plus `RsvpForm` (client). Without **both** `onLookup` and `onSubmit` it
  renders closed and collects nothing. Unlike the design kit, there is no demo fallback. Sprint 3
  wires the handlers.

# @ww/ui

Theming seam and design-system token contract: a Tailwind v4 preset, a CSS-variable token
layer (light + dark), a server-rendered `<ThemeProvider>` for per-site overrides, and three
**disposable** primitives (`Button`, `Card`, `Input`) that exist only to prove the seam.

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
  `transpilePackages: ["@ww/ui"]`.

## The token contract

Every token is a CSS variable `--ww-<name>`. The **names** are the contract that the Claude
Design import must satisfy. The **values** in `src/tokens.css` are placeholders. The canonical
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

## Replacing the primitives

`Button`, `Card` and `Input` are placeholders. The design import may delete or replace them
freely, as long as its components style themselves through the utilities above (or the
`--ww-*` variables directly). The contract lives in `token-contract.ts`, `tokens.css` and
`preset.css`, not in the primitives.

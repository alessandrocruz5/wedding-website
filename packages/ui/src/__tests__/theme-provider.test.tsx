import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../primitives/button";
import { Card } from "../primitives/card";
import { Input } from "../primitives/input";
import { buildThemeCss, isSafeTokenValue, ThemeProvider } from "../theme-provider";

function renderPage(node: ReactNode): string {
  return renderToString(
    <html>
      <head />
      <body>{node}</body>
    </html>,
  );
}

describe("isSafeTokenValue", () => {
  it.each([
    "#b76e79",
    "oklch(0.62 0.12 30)",
    "rgb(10 20 30 / 50%)",
    "color-mix(in oklch, var(--ww-color-primary) 20%, white)",
    '"Playfair Display", Georgia, serif',
    "calc((1rem + 2px) * 2)",
    "0",
  ])("accepts %s", (value) => {
    expect(isSafeTokenValue(value)).toBe(true);
  });

  it.each([
    ["style breakout", "red</style><script>alert(1)</script>"],
    ["declaration injection", "red; background: blue"],
    ["rule injection", "red} body{display:none"],
    ["at-rule", "@import 'x'"],
    ["!important", "red !important"],
    ["escape sequence", "u\\72l(x)"],
    ["url()", "url(//evil.example/p.png)"],
    ["uppercase URL()", "URL(//evil.example/p.png)"],
    ["image-set()", "image-set(x 1x)"],
    ["unbalanced paren", "rgb(1 2 3"],
    ["unbalanced quote", '"Playfair'],
    ["comment", "red /* x"],
    ["empty", "   "],
    ["too long", "a".repeat(201)],
    ["non-string", 42],
  ])("rejects %s", (_label, value) => {
    expect(isSafeTokenValue(value)).toBe(false);
  });
});

describe("buildThemeCss", () => {
  it("returns empty for no overrides", () => {
    expect(buildThemeCss(null)).toBe("");
    expect(buildThemeCss({})).toBe("");
  });

  it("drops unknown keys and unsafe values", () => {
    expect(
      buildThemeCss({
        "color-primary": "url(//evil.example)",
        "not-a-token": "red",
        "--ww-color-primary": "red",
        "dark:nope": "red",
        radius: "0.75rem",
      }),
    ).toBe("[data-ww-theme]{--ww-radius:0.75rem}");
  });

  it("applies brand overrides to both modes", () => {
    expect(buildThemeCss({ "color-primary": "#b76e79" })).toBe(
      "[data-ww-theme]{--ww-color-primary:#b76e79}",
    );
  });

  it("scopes an unprefixed surface override to light mode only", () => {
    const css = buildThemeCss({ "color-background": "white" });
    expect(css).toBe(
      '[data-ww-theme][data-ww-mode="light"]{--ww-color-background:white}' +
        '@media (prefers-color-scheme: light){[data-ww-theme]:not([data-ww-mode="dark"]){--ww-color-background:white}}',
    );
  });

  it("emits dark: overrides for forced and system dark", () => {
    const css = buildThemeCss({ "dark:color-background": "black" });
    expect(css).toBe(
      '[data-ww-theme][data-ww-mode="dark"]{--ww-color-background:black}' +
        '@media (prefers-color-scheme: dark){[data-ww-theme]:not([data-ww-mode="light"]){--ww-color-background:black}}',
    );
  });
});

describe("ThemeProvider (SSR)", () => {
  it("hoists the site's overrides into <head> so first paint is themed", () => {
    const html = renderPage(
      <ThemeProvider preset="garden" tokens={{ "color-primary": "#b76e79" }}>
        <p>hi</p>
      </ThemeProvider>,
    );
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    expect(head).toContain('data-precedence="ww-theme"');
    expect(head).toContain("[data-ww-theme]{--ww-color-primary:#b76e79}");
    expect(html).toContain(
      '<div data-ww-theme="" data-ww-preset="garden" data-ww-mode="system"><p>hi</p></div>',
    );
  });

  it("renders no <style> when there is nothing to override", () => {
    const html = renderPage(<ThemeProvider preset="classic">x</ThemeProvider>);
    expect(html).not.toContain("<style");
  });

  it("falls back to the default preset for malformed names and honours a forced mode", () => {
    const html = renderPage(
      <ThemeProvider preset={'x"><script>'} mode="dark">
        x
      </ThemeProvider>,
    );
    expect(html).toContain('data-ww-preset="default" data-ww-mode="dark"');
    expect(html).not.toContain("<script");
  });

  it("never renders a hostile token value", () => {
    const html = renderPage(
      <ThemeProvider tokens={{ "color-primary": "red</style><script>alert(1)</script>" }}>
        x
      </ThemeProvider>,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<style");
  });
});

describe("primitives", () => {
  it("render token-driven classes and pass props through", () => {
    const html = renderToString(
      <Card className="extra">
        <Input placeholder="Name" />
        <Button variant="outline" disabled>
          RSVP
        </Button>
      </Card>,
    );
    expect(html).toContain("bg-surface");
    expect(html).toContain("extra");
    expect(html).toContain("border-input");
    expect(html).toContain('placeholder="Name"');
    expect(html).toContain('type="button"');
    expect(html).toContain("border-border");
    expect(html).toContain("disabled");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { heroSlides } from "@/content/placeholder";
import { HeroCarousel } from "../hero-carousel";

describe("HeroCarousel", () => {
  const html = renderToStaticMarkup(
    <HeroCarousel slides={heroSlides}>
      <h1>Ana &amp; Ben</h1>
    </HeroCarousel>,
  );
  const imgs = html.match(/<img [^>]*>/g) ?? [];

  it("renders 3 slides, each with alt text", () => {
    expect(heroSlides).toHaveLength(3);
    expect(html.match(/class="ww-hero-slide /g)).toHaveLength(3);
    expect(imgs).toHaveLength(3);
    for (const { alt } of heroSlides) {
      expect(alt.trim()).not.toBe("");
      expect(html).toContain(`alt="${alt}"`);
    }
  });

  it("loads only the first image eagerly", () => {
    expect(imgs[0]).not.toContain('loading="lazy"');
    expect(imgs.slice(1).every((img) => img.includes('loading="lazy"'))).toBe(true);
  });

  it("renders a named pause button and the hero text", () => {
    expect(html).toMatch(/<button type="button" aria-label="Pause slideshow"/);
    expect(html).toContain("<h1>Ana &amp; Ben</h1>");
  });

  it("stops the crossfade under reduced motion", () => {
    expect(html).toContain(
      "@media (prefers-reduced-motion:reduce){.ww-hero-slide{animation:none}}",
    );
  });
});

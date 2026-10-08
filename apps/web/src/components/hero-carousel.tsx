"use client";

import Image, { type StaticImageData } from "next/image";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

const SLIDE_SECONDS = 6;
const FADE_SECONDS = 1;

/**
 * One keyframe track shared by every slide, offset by `animation-delay`: a slide fades in as the
 * one before it fades out, holds, then hands over. Reduced motion drops the animation and leaves
 * the first slide showing.
 */
function crossfadeCss(count: number): string {
  const cycle = count * SLIDE_SECONDS;
  const pct = (s: number) => `${((s / cycle) * 100).toFixed(3)}%`;
  return `@keyframes ww-hero-fade{0%{opacity:0}${pct(FADE_SECONDS)}{opacity:1}${pct(SLIDE_SECONDS)}{opacity:1}${pct(SLIDE_SECONDS + FADE_SECONDS)}{opacity:0}100%{opacity:0}}
.ww-hero-slide{animation:ww-hero-fade ${cycle}s ease-in-out infinite both}
.ww-hero[data-paused] .ww-hero-slide{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.ww-hero-slide{animation:none}}`;
}

/**
 * Reports the sticky header's real height (it wraps to two rows on phones, and grows with the
 * user's font size) now and on every resize. Returns a cleanup function.
 */
export function watchHeaderHeight(
  header: Element | null,
  onHeight: (px: number) => void,
  Observer?: typeof ResizeObserver,
): () => void {
  if (!header) return () => {};
  const read = () => onHeight(Math.round(header.getBoundingClientRect().height));
  read();
  const observer = new (Observer ?? ResizeObserver)(read);
  observer.observe(header);
  return () => observer.disconnect();
}

interface HeroCarouselProps {
  slides: { src: StaticImageData; alt: string }[];
  /** The hero text, laid over the dimmed photos. */
  children: ReactNode;
}

/**
 * Full-height home hero: photos crossfade behind a bark dim (65%, so linen text keeps AA contrast
 * even over a white pixel). Only the pause button needs JS; the crossfade is CSS.
 */
export function HeroCarousel({ slides, children }: HeroCarouselProps) {
  const [paused, setPaused] = useState(false);
  const [headerH, setHeaderH] = useState<number | null>(null);
  useEffect(() => watchHeaderHeight(document.querySelector("header"), setHeaderH), []);
  // --ww-header-h is the sticky nav's height. The classes are the pre-measure fallback (it wraps
  // to two rows below `sm`); the inline value replaces them once the real header is measured.
  const style = headerH ? ({ "--ww-header-h": `${headerH}px` } as CSSProperties) : undefined;
  return (
    <section
      style={style}
      className="relative isolate flex min-h-[calc(100svh-var(--ww-header-h))] items-center overflow-hidden bg-inverse [--ww-header-h:94px] sm:[--ww-header-h:59px]"
    >
      <style>{crossfadeCss(slides.length)}</style>
      <div className="ww-hero absolute inset-0 -z-10" data-paused={paused || undefined}>
        {slides.map((slide, i) => (
          <div
            key={i}
            className={
              i > 0 ? "ww-hero-slide absolute inset-0 opacity-0" : "ww-hero-slide absolute inset-0"
            }
            style={{ animationDelay: `${i * SLIDE_SECONDS - FADE_SECONDS}s` }}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-inverse/65" />
      </div>
      {children}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Play slideshow" : "Pause slideshow"}
        className="absolute right-4 bottom-8 flex size-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-inverse-foreground/60 bg-inverse/40 text-inverse-foreground transition-colors duration-160 ease-arc hover:bg-inverse/70 focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none motion-reduce:hidden sm:right-6"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          {paused ? <path d="M4 2.5v11l9-5.5z" /> : <path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" />}
        </svg>
      </button>
    </section>
  );
}

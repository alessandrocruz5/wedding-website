/** The seeded demo sites (`@ww/db` DEMO_SITES), served by path at `/s/{slug}`. */
export const DEMOS = [
  {
    slug: "ana-and-ben",
    name: "Ana & Ben",
    preset: "classic",
    blurb: "Warm ivory and serif type.",
  },
  {
    slug: "carla-and-dan",
    name: "Carla & Dan",
    preset: "garden",
    blurb: "Soft greens, botanical mood.",
  },
  {
    slug: "eli-and-faye",
    name: "Eli & Faye",
    preset: "modern",
    blurb: "Clean, high-contrast and minimal.",
  },
] as const;

export const REPO_URL = "https://github.com/alessandrocruz5/wedding-website";

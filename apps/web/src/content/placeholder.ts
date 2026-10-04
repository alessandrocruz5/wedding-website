/**
 * SAMPLE CONTENT from the Claude Design kit (WW-3). Every site shows it, under its own names,
 * until Sprint 2's per-site content model replaces this file. Never put real guest data here.
 */
import type { AccordionItem, BadgeTone } from "@ww/ui";

export const details = {
  dateLine: "October 16, 2027 · Hollis Farm, Hudson Valley",
  weekendRange: "October 15 – 17",
  weddingDate: "Saturday, October 16",
  replyBy: "August 1",
};

export const story =
  "One of us was late for a train; the other had the only umbrella on the platform. Eight years, two cities and one very patient dog later, we’re getting married on the farm where our grandparents did.";

export const weekendEvents = [
  {
    day: "Friday",
    name: "Welcome drinks",
    time: "7pm · The Orchard Barn",
    attire: "Come as you are",
  },
  {
    day: "Saturday",
    name: "Ceremony & dinner",
    time: "4:30pm · The Meadow",
    attire: "Garden cocktail",
  },
  { day: "Sunday", name: "Farewell brunch", time: "10am · Main House lawn", attire: "Casual" },
];

export interface ScheduleItem {
  time: string;
  ampm: "am" | "pm";
  name: string;
  place: string;
  note: string;
  badges: [BadgeTone, string][];
}

export const scheduleDays: { day: string; items: ScheduleItem[] }[] = [
  {
    day: "Friday, October 15",
    items: [
      {
        time: "7:00",
        ampm: "pm",
        name: "Welcome drinks",
        place: "The Orchard Barn",
        note: "Cider, a fire pit and too many snacks. Drop in whenever you arrive.",
        badges: [["neutral", "Come as you are"]],
      },
    ],
  },
  {
    day: "Saturday, October 16",
    items: [
      {
        time: "3:30",
        ampm: "pm",
        name: "Shuttles depart",
        place: "Hotel Arlo & town square",
        note: "Two runs, fifteen minutes apart.",
        badges: [["sage", "Shuttle"]],
      },
      {
        time: "4:30",
        ampm: "pm",
        name: "Ceremony",
        place: "The Meadow",
        note: "Short, sweet and outdoors — heels sink, so choose accordingly.",
        badges: [["ochre", "Garden cocktail"]],
      },
      {
        time: "5:15",
        ampm: "pm",
        name: "Cocktail hour",
        place: "The Terrace",
        note: "Lawn games and a raw bar.",
        badges: [],
      },
      {
        time: "6:30",
        ampm: "pm",
        name: "Dinner & dancing",
        place: "The Big Barn",
        note: "Family-style dinner, then the band plays until 11.",
        badges: [["clay", "Seated dinner"]],
      },
    ],
  },
  {
    day: "Sunday, October 17",
    items: [
      {
        time: "10:00",
        ampm: "am",
        name: "Farewell brunch",
        place: "Main House lawn",
        note: "Coffee, pastries and one last goodbye.",
        badges: [["neutral", "Casual"]],
      },
    ],
  },
];

/** `bookingUrl` is a sample (example.com, reserved by RFC 2606) so the "Book a room" link renders. */
export const hotels: {
  name: string;
  meta: string;
  badge: string;
  tone: "sand" | "sage";
  bookingUrl?: string;
}[] = [
  {
    name: "Hotel Arlo",
    meta: "12 min from the farm · shuttle stop",
    badge: "Room block · code HOLLIS27",
    tone: "sand",
    bookingUrl: "https://example.com/hotel-arlo",
  },
  {
    name: "The Millhouse Inn",
    meta: "6 min from the farm · walkable to town",
    badge: "Room block · until Sept 1",
    tone: "sage",
    bookingUrl: "https://example.com/the-millhouse-inn",
  },
];

export const travelModes: [string, string][] = [
  ["Fly", "Albany (ALB) is 50 minutes away. Stewart (SWF) is about an hour."],
  ["Train", "Take the line to Hudson; it’s a 15-minute taxi from the station."],
  ["Drive", "Two hours from the city. Park on the upper field, follow the lanterns."],
];

export const faqs: AccordionItem[] = [
  {
    question: "Are kids welcome?",
    answer:
      "We adore your little ones, but Saturday evening is adults-only. Kids are very welcome at Friday drinks and Sunday brunch, and we can share local sitter recommendations.",
  },
  {
    question: "What should I wear?",
    answer:
      "Garden cocktail for Saturday. The ceremony is on grass, so block heels or flats are your friend, and bring a layer — October evenings get cool.",
  },
  {
    question: "Can I bring a plus-one?",
    answer:
      "Your invitation lists everyone we’ve saved a seat for. If you have questions, just reach out — no awkwardness, promise.",
  },
  {
    question: "Is there parking?",
    answer:
      "Yes, free parking on the upper field. If you plan to celebrate, the shuttle is the way to go.",
  },
];

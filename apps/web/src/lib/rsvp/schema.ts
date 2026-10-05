import { z } from "zod";

// Caps mirror the rsvp_responses CHECKs (0002_rsvp), so a valid payload never trips one.
const MAX_NAME = 200;
const MAX_GUESTS = 20;
const MAX_EVENTS = 10;
const MAX_SEATS = 20;

/** Same RFC 2606 rule as `rsvp_responses_email_reserved_domain`: no real addresses in the demo. */
const RESERVED_EMAIL =
  /^[^@\s]+@([a-z0-9-]+[.])*(example[.](com|net|org)|[a-z0-9-]+[.](test|example|invalid))$/i;

/** A form option id (meal, event, shuttle): short and slug-shaped, never free text. */
const optionId = z.string().regex(/^[a-z0-9-]{1,40}$/);

/** Optional free text: trimmed, capped, and "" stored as null. */
const freeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

/** The name typed at lookup: trimmed, inner whitespace collapsed, same cap as `guests.full_name`. */
export const lookupNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NAME)
  .transform((v) => v.replace(/\s+/g, " "));

const guestReplySchema = z
  .strictObject({
    guestId: z.uuid(),
    attending: z.boolean(),
    meal: optionId.nullable(),
    events: z.array(optionId).max(MAX_EVENTS),
  })
  .refine((g) => g.attending || (g.meal === null && g.events.length === 0), {
    message: "A guest who declines has no meal or events.",
  });

/**
 * A whole-party reply (`RsvpSubmission` from @ww/ui). Strict: unknown keys (e.g. a `siteId`)
 * are rejected, not stripped. That every `guestId` belongs to the invitation is checked
 * against the DB in `submitRsvp`, not here.
 */
export const rsvpSubmissionSchema = z
  .strictObject({
    invitationId: z.uuid(),
    guests: z
      .array(guestReplySchema)
      .min(1)
      .max(MAX_GUESTS)
      .refine((gs) => new Set(gs.map((g) => g.guestId)).size === gs.length, {
        message: "Each guest can reply once.",
      }),
    shuttle: optionId.nullable(),
    shuttleSeats: z.number().int().min(0).max(MAX_SEATS),
    dietary: freeText(1000),
    song: freeText(200),
    note: freeText(2000),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email())
      .refine((v) => RESERVED_EMAIL.test(v)),
  })
  .refine((r) => r.shuttleSeats <= r.guests.filter((g) => g.attending).length, {
    path: ["shuttleSeats"],
    message: "More seats than attending guests.",
  });

export type RsvpSubmissionInput = z.input<typeof rsvpSubmissionSchema>;
export type ValidRsvpSubmission = z.output<typeof rsvpSubmissionSchema>;

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { invitations } from "./invitations";

/** One guest's line of a reply; `guestId` must belong to the reply's invitation (app-validated). */
export interface RsvpGuestReplyRow {
  guestId: string;
  attending: boolean;
  meal: string | null;
  events: string[];
}

/**
 * The current RSVP for an invitation: one row per invitation, re-submitting updates it.
 * Holds PII (email, free text). The app role may write it but can read back only `invitation_id`.
 */
export const rsvpResponses = pgTable(
  "rsvp_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull(),
    invitationId: uuid("invitation_id").notNull().unique(),
    guests: jsonb("guests").$type<RsvpGuestReplyRow[]>().notNull(),
    shuttle: text("shuttle"),
    shuttleSeats: integer("shuttle_seats").notNull().default(0),
    dietary: text("dietary"),
    song: text("song"),
    note: text("note"),
    email: text("email").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Composite FK: a reply can only target an invitation of its own site (FK checks bypass RLS).
    foreignKey({
      name: "rsvp_responses_invitation_same_site_fk",
      columns: [t.siteId, t.invitationId],
      foreignColumns: [invitations.siteId, invitations.id],
    }).onDelete("cascade"),
    // The only unbounded field on a public write path: cap entries and stored size.
    check(
      "rsvp_responses_guests_shape",
      sql`case when jsonb_typeof(${t.guests}) = 'array'
        then jsonb_array_length(${t.guests}) between 1 and 20 and pg_column_size(${t.guests}) <= 16384
        else false end`,
    ),
    check("rsvp_responses_shuttle_seats_range", sql`${t.shuttleSeats} between 0 and 20`),
    check("rsvp_responses_email_length", sql`char_length(${t.email}) between 3 and 254`),
    // Demo phase: no real addresses on the free-tier DBs. Reserved names only (RFC 2606).
    // Lift with a migration once the Guest/RSVP sprint adds consent and retention (README).
    check(
      "rsvp_responses_email_reserved_domain",
      sql`lower(${t.email}) ~ '^[^@[:space:]]+@([a-z0-9-]+[.])*(example[.](com|net|org)|[a-z0-9-]+[.](test|example|invalid))$'`,
    ),
    check(
      "rsvp_responses_text_length",
      sql`coalesce(char_length(${t.shuttle}), 0) <= 100
        and coalesce(char_length(${t.dietary}), 0) <= 1000
        and coalesce(char_length(${t.song}), 0) <= 200
        and coalesce(char_length(${t.note}), 0) <= 2000`,
    ),
  ],
);

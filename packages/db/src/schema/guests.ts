import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { invitations } from "./invitations";

/** A named person on an invitation. Guest names are PII (see README → Retention). */
export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull(),
    invitationId: uuid("invitation_id").notNull(),
    fullName: text("full_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Composite FK: a guest can only join an invitation of the same site (FK checks bypass RLS).
    foreignKey({
      name: "guests_invitation_same_site_fk",
      columns: [t.siteId, t.invitationId],
      foreignColumns: [invitations.siteId, invitations.id],
    }).onDelete("cascade"),
    index("guests_invitation_id_idx").on(t.invitationId),
    // Exact-name RSVP lookup within a site.
    index("guests_site_id_name_idx").on(t.siteId, sql`lower(${t.fullName})`),
    check("guests_full_name_length", sql`char_length(${t.fullName}) between 1 and 200`),
  ],
);

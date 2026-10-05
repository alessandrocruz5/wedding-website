import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sites } from "./sites";

/** One party invited to a site's wedding. Guests and the RSVP reply hang off it. */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Display name for the party, e.g. "The Ellis family". */
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Target of the composite FKs (children stay in their site); also serves site_id lookups.
    unique("invitations_site_id_id_unique").on(t.siteId, t.id),
    check("invitations_label_length", sql`char_length(${t.label}) between 1 and 200`),
  ],
);

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sites } from "./sites";

/** Hostnames that resolve to a site. Stored lowercase, without port. */
export const siteDomains = pgTable(
  "site_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull().unique(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("site_domains_site_id_idx").on(t.siteId),
    uniqueIndex("site_domains_one_primary_per_site")
      .on(t.siteId)
      .where(sql`${t.isPrimary}`),
    check("site_domains_hostname_lowercase", sql`${t.hostname} = lower(${t.hostname})`),
  ],
);

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sites } from "./sites";

/** One theme per site: a preset name plus CSS-variable token overrides. */
export const siteTheme = pgTable("site_theme", {
  siteId: uuid("site_id")
    .primaryKey()
    .references(() => sites.id, { onDelete: "cascade" }),
  preset: text("preset").notNull().default("default"),
  tokens: jsonb("tokens").$type<Record<string, string>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

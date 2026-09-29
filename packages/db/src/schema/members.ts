import { index, pgEnum, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { sites } from "./sites";
import { users } from "./users";

export const siteMemberRole = pgEnum("site_member_role", ["owner", "editor"]);

export const siteMembers = pgTable(
  "site_members",
  {
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: siteMemberRole("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.siteId, t.userId] }),
    index("site_members_user_id_idx").on(t.userId),
  ],
);

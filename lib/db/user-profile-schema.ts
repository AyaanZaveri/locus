import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import type { UserProfile } from "../user-profile";

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  profile: jsonb("profile").$type<UserProfile>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastResumeImportAt: timestamp("last_resume_import_at", {
    withTimezone: true,
  }),
});

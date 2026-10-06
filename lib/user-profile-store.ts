import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userProfiles } from "@/lib/db/user-profile-schema";
import {
  EMPTY_USER_PROFILE,
  userProfileSchema,
  type UserProfile,
} from "@/lib/user-profile";

export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({ profile: userProfiles.profile })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return row ? userProfileSchema.parse(row.profile) : null;
}

export async function saveUserProfile(userId: string, profile: UserProfile) {
  await db
    .insert(userProfiles)
    .values({ userId, profile })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { profile, updatedAt: new Date() },
    });
}

// Persisted and atomic, so concurrent requests and multiple app instances cannot
// bypass the one-attempt-per-minute limit. Failures still consume the attempt.
export async function reserveResumeImport(userId: string) {
  const now = new Date();
  const rows = await db
    .insert(userProfiles)
    .values({ userId, profile: EMPTY_USER_PROFILE, lastResumeImportAt: now })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { lastResumeImportAt: now },
      setWhere: sql`${userProfiles.lastResumeImportAt} IS NULL OR ${userProfiles.lastResumeImportAt} < now() - interval '1 minute'`,
    })
    .returning({ userId: userProfiles.userId });
  return rows.length === 1;
}

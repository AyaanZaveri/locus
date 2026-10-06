import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userProfiles } from "@/lib/db/user-profile-schema";
import { userProfileSchema, type UserProfile } from "@/lib/user-profile";

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

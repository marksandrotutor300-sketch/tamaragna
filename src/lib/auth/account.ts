import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { createProfile, getProfile, setDeviceCookie } from "@/lib/db/auth";
import { profiles, users, type Profile } from "@/lib/db/schema";

export type User = typeof users.$inferSelect;

/**
 * Find or create the account for a verified email. Only called after the
 * provider has proven ownership of the address (magic link or Google).
 */
export async function resolveUser(email: string): Promise<User> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing[0]) {
    if (existing[0].emailVerifiedAt) return existing[0];
    const updated = await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, existing[0].id))
      .returning();
    return updated[0] ?? existing[0];
  }

  const inserted = await db
    .insert(users)
    .values({ email: normalized, emailVerifiedAt: new Date() })
    .returning();
  return inserted[0];
}

/**
 * The profile a signed-in account should use. Prefers the account's existing
 * ranch; otherwise claims the current anonymous device ranch when it is
 * unowned. A device already linked to another account is never stolen.
 */
export async function resolveProfileForUser(userId: string): Promise<Profile> {
  const db = await getDb();

  const owned = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (owned[0]) return owned[0];

  const device = await getProfile();
  if (device && !device.userId) {
    const linked = await db
      .update(profiles)
      .set({ userId })
      .where(eq(profiles.id, device.id))
      .returning();
    return linked[0] ?? device;
  }

  const created = await createProfile();
  const linked = await db
    .update(profiles)
    .set({ userId })
    .where(eq(profiles.id, created.id))
    .returning();
  const profile = linked[0] ?? created;
  await setDeviceCookie(profile.deviceId);
  return profile;
}

import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "./client";
import { profiles, seasons, type Profile } from "./schema";

export const DEVICE_COOKIE = "tr_device";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5;

export async function setDeviceCookie(deviceId: string): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Anonymous identity: a long-lived httpOnly device cookie is the credential.
 * No email, no password, no third-party auth. Players can later link devices
 * with a transfer code.
 */
export async function currentSeason(): Promise<number> {
  const db = await getDb();
  const seasonRow = await db
    .select({ id: seasons.id })
    .from(seasons)
    .orderBy(desc(seasons.id))
    .limit(1);
  const profileSeason = await db
    .select({ season: profiles.season })
    .from(profiles)
    .orderBy(desc(profiles.season))
    .limit(1);
  return Math.max(seasonRow[0]?.id ?? 1, profileSeason[0]?.season ?? 1);
}

export async function createProfile(
  deviceId = crypto.randomUUID(),
): Promise<Profile> {
  const db = await getDb();
  const season = await currentSeason();
  const inserted = await db
    .insert(profiles)
    .values({ deviceId, displayName: "Trainer", season })
    .returning();
  return inserted[0];
}

export async function getOrCreateProfile(): Promise<Profile> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value;
  const db = await getDb();

  if (existing) {
    const found = await db
      .select()
      .from(profiles)
      .where(eq(profiles.deviceId, existing))
      .limit(1);
    if (found[0]) return found[0];
  }

  const profile = await createProfile();
  await setDeviceCookie(profile.deviceId);
  return profile;
}

export async function getProfile(): Promise<Profile | null> {
  const jar = await cookies();
  const deviceId = jar.get(DEVICE_COOKIE)?.value;
  if (!deviceId) return null;

  const db = await getDb();
  const found = await db
    .select()
    .from(profiles)
    .where(eq(profiles.deviceId, deviceId))
    .limit(1);

  return found[0] ?? null;
}

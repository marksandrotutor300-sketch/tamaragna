import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicToken } from "@/lib/auth/magic";
import { ensureOwnerEmail } from "@/lib/admin";
import { createProfile, getProfile, setDeviceCookie } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";
import { createSession, hashToken } from "@/lib/db/session";
import { checkRateLimit, clientKey, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const ip = clientKey(request);
  if (!(await checkRateLimit(`${ip}:auth-verify`, LIMITS.authVerify))) {
    return NextResponse.redirect(new URL("/signin?error=rate", request.url));
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const email = token ? await consumeMagicToken(token) : null;
  if (!email) {
    return NextResponse.redirect(new URL("/signin?error=invalid", request.url));
  }

  const db = await getDb();
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user = existingUser[0];
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({ email, emailVerifiedAt: new Date() })
      .returning();
    user = inserted[0];
  } else if (!user.emailVerifiedAt) {
    const updated = await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    user = updated[0] ?? user;
  }

  const userProfiles = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  let profile = userProfiles[0];
  if (!profile) {
    const device = await getProfile();
    if (device && !device.userId) {
      const linked = await db
        .update(profiles)
        .set({ userId: user.id })
        .where(eq(profiles.id, device.id))
        .returning();
      profile = linked[0] ?? device;
    } else {
      const created = await createProfile();
      const linked = await db
        .update(profiles)
        .set({ userId: user.id })
        .where(eq(profiles.id, created.id))
        .returning();
      profile = linked[0] ?? created;
      await setDeviceCookie(profile.deviceId);
    }
  }

  await ensureOwnerEmail(user.id, user.email);

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ipHash: hashToken(ip),
  });

  return NextResponse.redirect(new URL("/account?welcome=1", request.url));
}

import { eq } from "drizzle-orm";
import {
  createProfile,
  getOrCreateProfile,
  getProfile,
  setDeviceCookie,
} from "./auth";
import { readSession } from "./session";
import { getDb } from "./client";
import { profiles, type Profile } from "./schema";

export type Actor = {
  profile: Profile;
  userId: string | null;
  email: string | null;
  sessionId: string | null;
  authenticated: boolean;
};

export type AuthenticatedActor = Actor & {
  userId: string;
  sessionId: string;
  authenticated: true;
};

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

/**
 * A session user owns exactly one linked profile. If the account has no profile
 * yet, the current device ranch is linked; a device already linked to another
 * account is never stolen.
 */
export async function getActor(): Promise<Actor> {
  const session = await readSession();
  const db = await getDb();

  if (session) {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, session.userId))
      .limit(1);

    let profile = rows[0];
    if (!profile) {
      const device = await getProfile();
      if (device && !device.userId) {
        const linked = await db
          .update(profiles)
          .set({ userId: session.userId })
          .where(eq(profiles.id, device.id))
          .returning();
        profile = linked[0] ?? device;
      } else {
        const created = await createProfile();
        const linked = await db
          .update(profiles)
          .set({ userId: session.userId })
          .where(eq(profiles.id, created.id))
          .returning();
        profile = linked[0] ?? created;
        await setDeviceCookie(profile.deviceId);
      }
    }

    return {
      profile,
      userId: session.userId,
      email: session.email,
      sessionId: session.sessionId,
      authenticated: true,
    };
  }

  return {
    profile: await getOrCreateProfile(),
    userId: null,
    email: null,
    sessionId: null,
    authenticated: false,
  };
}

export function requireUser(actor: Actor): asserts actor is AuthenticatedActor {
  if (!actor.authenticated || !actor.userId || !actor.sessionId) {
    throw new AuthRequiredError();
  }
}

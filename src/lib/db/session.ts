import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "./client";
import { sessions, users } from "./schema";

export const SESSION_COOKIE = "tr_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionIdentity = {
  sessionId: string;
  userId: string;
  email: string;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipHash?: string | null } = {},
): Promise<{ sessionId: string; token: string }> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const inserted = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipHash: meta.ipHash ?? null,
    })
    .returning({ id: sessions.id });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions());

  return { sessionId: inserted[0].id, token };
}

export async function readSession(): Promise<SessionIdentity | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.id, row.sessionId));

  return row;
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  for (const row of rows) {
    if (row.id !== currentSessionId) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, row.id));
    }
  }
}

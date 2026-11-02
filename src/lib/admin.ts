import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { readSession } from "@/lib/db/session";

/**
 * Token gate. Set ADMIN_TOKEN and send it as `Authorization: Bearer <token>`
 * or `x-admin-token`. Missing config denies all.
 */
export function isAdminRequest(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const headerToken = request.headers.get("x-admin-token") ?? "";
  return authorization === `Bearer ${token}` || headerToken === token;
}

export function adminGuard(request: Request): Response | null {
  if (isAdminRequest(request)) return null;
  return Response.json({ error: "Not found" }, { status: 404 });
}

export type AdminIdentity = {
  /** "ADMIN_TOKEN" for the shared token, otherwise the signed-in email. */
  label: string;
  via: "token" | "session";
};

/**
 * True for an account flagged `users.is_super_admin`. Takes a user id so it
 * never has to resolve (or create) an anonymous device profile.
 */
export async function isSuperAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const db = await getDb();
  const rows = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return rows[0]?.isSuperAdmin === true;
}

export async function getAdminIdentity(
  request: Request,
): Promise<AdminIdentity | null> {
  if (isAdminRequest(request)) {
    return { label: "ADMIN_TOKEN", via: "token" };
  }

  const session = await readSession();
  if (!session) return null;
  if (!(await isSuperAdminUser(session.userId))) return null;
  return { label: session.email, via: "session" };
}

/**
 * Accepts either the shared ADMIN_TOKEN or a super-admin account session.
 * Fails with the same masked 404 as {@link adminGuard}.
 */
export async function superAdminGuard(request: Request): Promise<Response | null> {
  const identity = await getAdminIdentity(request);
  if (identity) return null;
  return Response.json({ error: "Not found" }, { status: 404 });
}

import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, type AdminRole } from "@/lib/db/schema";
import { readSession } from "@/lib/db/session";

/**
 * Token gate. Set ADMIN_TOKEN and send it as `Authorization: Bearer <token>`
 * or `x-admin-token`. Missing config denies all. The shared token is treated as
 * owner-level so it can bootstrap the first account.
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
  role: AdminRole;
  userId: string | null;
  email: string | null;
};

export function designatedOwnerEmail(): string | null {
  const value = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return value || null;
}

/**
 * Makes the configured OWNER_EMAIL account the owner only when the deployment
 * has no owner yet. This is a bootstrap, not a permanent override: an explicit
 * owner transfer must be able to move ownership away from the bootstrap email.
 */
export async function ensureOwnerEmail(
  userId: string,
  email: string,
): Promise<AdminRole | null> {
  const ownerEmail = designatedOwnerEmail();
  if (!ownerEmail || email.trim().toLowerCase() !== ownerEmail) return null;

  const db = await getDb();
  const currentOwners = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.adminRole, "owner"));
  if (currentOwners.some((owner) => owner.id !== userId)) return null;

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ adminRole: "admin", isSuperAdmin: true })
      .where(and(eq(users.adminRole, "owner"), ne(users.id, userId)));
    await tx
      .update(users)
      .set({ adminRole: "owner", isSuperAdmin: true })
      .where(eq(users.id, userId));
  });
  return "owner";
}

/**
 * Resolves the hierarchy role from durable state. Legacy `is_super_admin`
 * accounts are treated as admins and upgraded lazily.
 */
export async function getAdminRoleForUser(
  userId: string | null,
  email?: string | null,
): Promise<AdminRole | null> {
  if (!userId) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      adminRole: users.adminRole,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  const ownerEmail = designatedOwnerEmail();
  if (
    ownerEmail &&
    user.email.trim().toLowerCase() === ownerEmail &&
    user.adminRole !== "owner"
  ) {
    const promoted = await ensureOwnerEmail(user.id, user.email);
    if (promoted) return promoted;
  }

  if (user.adminRole === "owner" || user.adminRole === "admin") {
    return user.adminRole;
  }
  if (user.isSuperAdmin) {
    await db
      .update(users)
      .set({ adminRole: "admin" })
      .where(eq(users.id, user.id));
    return "admin";
  }
  return null;
}

export async function isSuperAdminUser(userId: string | null): Promise<boolean> {
  return (await getAdminRoleForUser(userId)) !== null;
}

export async function getAdminIdentity(
  request: Request,
): Promise<AdminIdentity | null> {
  if (isAdminRequest(request)) {
    return {
      label: "ADMIN_TOKEN",
      via: "token",
      role: "owner",
      userId: null,
      email: null,
    };
  }

  const session = await readSession();
  if (!session) return null;
  const role = await getAdminRoleForUser(session.userId, session.email);
  if (!role) return null;
  return {
    label: session.email,
    via: "session",
    role,
    userId: session.userId,
    email: session.email,
  };
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

/** Owner-only guard for role management. Admins get the same masked 404. */
export async function ownerGuard(request: Request): Promise<Response | null> {
  const identity = await getAdminIdentity(request);
  if (identity?.role === "owner") return null;
  return Response.json({ error: "Not found" }, { status: 404 });
}

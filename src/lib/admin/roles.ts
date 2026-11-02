import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  adminRoleEvents,
  users,
  type AdminRole,
  type User,
} from "@/lib/db/schema";
import type { AdminIdentity } from "@/lib/admin";

export class RoleError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RoleError";
    this.status = status;
  }
}

export function roleFailure(error: unknown): Response {
  if (error instanceof RoleError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[admin.roles]", error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export type RoleAccount = {
  id: string;
  email: string;
  role: AdminRole | null;
  createdAt: string;
};

export type RoleEvent = {
  id: string;
  actorLabel: string;
  targetEmail: string;
  action: string;
  previousRole: AdminRole | null;
  newRole: AdminRole | null;
  reason: string;
  createdAt: string;
};

function effectiveRole(user: Pick<User, "adminRole" | "isSuperAdmin">): AdminRole | null {
  if (user.adminRole === "owner" || user.adminRole === "admin") return user.adminRole;
  return user.isSuperAdmin ? "admin" : null;
}

function toAccount(user: User): RoleAccount {
  return {
    id: user.id,
    email: user.email,
    role: effectiveRole(user),
    createdAt: user.createdAt.toISOString(),
  };
}

function toEvent(event: typeof adminRoleEvents.$inferSelect): RoleEvent {
  return {
    id: event.id,
    actorLabel: event.actorLabel,
    targetEmail: event.targetEmail,
    action: event.action,
    previousRole: event.previousRole ?? null,
    newRole: event.newRole ?? null,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
}

function assertOwner(identity: AdminIdentity): void {
  if (identity.role !== "owner") {
    throw new RoleError("Only the owner can manage admin roles", 403);
  }
}

async function findUserByEmail(email: string): Promise<User> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new RoleError("Email is required", 422);
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, normalized), isNull(users.deletedAt)))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new RoleError(
      "No account for that email. They must sign in with a magic link once.",
      404,
    );
  }
  return user;
}

async function findUserById(userId: string): Promise<User> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  const user = rows[0];
  if (!user) throw new RoleError("Account not found", 404);
  return user;
}

export async function listAccounts(identity: AdminIdentity): Promise<RoleAccount[]> {
  if (identity.role !== "owner") return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(desc(users.createdAt))
    .limit(200);
  return rows.map(toAccount);
}

export async function listRoleEvents(
  identity: AdminIdentity,
  limit = 100,
): Promise<RoleEvent[]> {
  const db = await getDb();
  const capped = Math.min(Math.max(limit, 1), 200);
  let rows;
  if (identity.role === "owner") {
    rows = await db
      .select()
      .from(adminRoleEvents)
      .orderBy(desc(adminRoleEvents.createdAt))
      .limit(capped);
  } else {
    rows = await db
      .select()
      .from(adminRoleEvents)
      .where(
        or(
          eq(adminRoleEvents.actorUserId, identity.userId ?? ""),
          eq(adminRoleEvents.targetUserId, identity.userId ?? ""),
        ),
      )
      .orderBy(desc(adminRoleEvents.createdAt))
      .limit(capped);
  }
  return rows.map(toEvent);
}

export async function searchAccounts(
  identity: AdminIdentity,
  query: string,
): Promise<RoleAccount[]> {
  assertOwner(identity);
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        or(ilike(users.email, `%${trimmed}%`), sql`${users.id}::text = ${trimmed}`),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(25);
  return rows.map(toAccount);
}

async function insertEvent(
  identity: AdminIdentity,
  target: User,
  action: string,
  previousRole: AdminRole | null,
  newRole: AdminRole | null,
  reason: string,
): Promise<void> {
  const db = await getDb();
  await db.insert(adminRoleEvents).values({
    actorUserId: identity.userId,
    actorLabel: identity.label,
    targetUserId: target.id,
    targetEmail: target.email,
    action,
    previousRole,
    newRole,
    reason: reason.slice(0, 500),
  });
}

export async function grantAdmin(
  identity: AdminIdentity,
  email: string,
  reason = "",
): Promise<RoleAccount> {
  assertOwner(identity);
  const target = await findUserByEmail(email);
  const current = effectiveRole(target);
  if (current === "owner") throw new RoleError("That account is the owner", 400);
  if (current === "admin") throw new RoleError("That account is already an admin", 409);

  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const [next] = await tx
      .update(users)
      .set({ adminRole: "admin", isSuperAdmin: true })
      .where(eq(users.id, target.id))
      .returning();
    await tx.insert(adminRoleEvents).values({
      actorUserId: identity.userId,
      actorLabel: identity.label,
      targetUserId: target.id,
      targetEmail: target.email,
      action: "grant",
      previousRole: current,
      newRole: "admin",
      reason: reason.slice(0, 500),
    });
    return next;
  });
  return toAccount(updated);
}

export async function revokeAdmin(
  identity: AdminIdentity,
  userId: string,
  reason = "",
): Promise<RoleAccount> {
  assertOwner(identity);
  const target = await findUserById(userId);
  const current = effectiveRole(target);
  if (current === "owner") throw new RoleError("The owner cannot be revoked", 400);
  if (!current) throw new RoleError("That account is not an admin", 409);

  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const [next] = await tx
      .update(users)
      .set({ adminRole: null, isSuperAdmin: false })
      .where(eq(users.id, target.id))
      .returning();
    await tx.insert(adminRoleEvents).values({
      actorUserId: identity.userId,
      actorLabel: identity.label,
      targetUserId: target.id,
      targetEmail: target.email,
      action: "revoke",
      previousRole: current,
      newRole: null,
      reason: reason.slice(0, 500),
    });
    return next;
  });
  return toAccount(updated);
}

export async function rollbackRole(
  identity: AdminIdentity,
  userId: string,
  reason = "",
): Promise<RoleAccount> {
  assertOwner(identity);
  const target = await findUserById(userId);
  const current = effectiveRole(target);
  if (current === "owner") throw new RoleError("The owner cannot be rolled back", 400);

  const db = await getDb();
  const prior = await db
    .select()
    .from(adminRoleEvents)
    .where(eq(adminRoleEvents.targetUserId, target.id))
    .orderBy(desc(adminRoleEvents.createdAt))
    .limit(1);
  const event = prior[0];
  if (!event) throw new RoleError("No role history for that account", 404);

  const previousRole = event.previousRole ?? null;
  if (previousRole === "owner") {
    throw new RoleError("Refusing to restore a second owner; transfer ownership instead", 400);
  }

  const updated = await db.transaction(async (tx) => {
    const [next] = await tx
      .update(users)
      .set({
        adminRole: previousRole,
        isSuperAdmin: previousRole !== null,
      })
      .where(eq(users.id, target.id))
      .returning();
    await tx.insert(adminRoleEvents).values({
      actorUserId: identity.userId,
      actorLabel: identity.label,
      targetUserId: target.id,
      targetEmail: target.email,
      action: "rollback",
      previousRole: current,
      newRole: previousRole,
      reason: reason.slice(0, 500),
    });
    return next;
  });
  return toAccount(updated);
}

export async function transferOwner(
  identity: AdminIdentity,
  email: string,
  reason = "",
): Promise<RoleAccount> {
  assertOwner(identity);
  const target = await findUserByEmail(email);
  const targetRole = effectiveRole(target);
  if (targetRole === "owner") return toAccount(target);

  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const currentOwners = await tx
      .select()
      .from(users)
      .where(and(eq(users.adminRole, "owner"), isNull(users.deletedAt)));
    for (const owner of currentOwners) {
      if (owner.id === target.id) continue;
      await tx
        .update(users)
        .set({ adminRole: "admin", isSuperAdmin: true })
        .where(eq(users.id, owner.id));
      await tx.insert(adminRoleEvents).values({
        actorUserId: identity.userId,
        actorLabel: identity.label,
        targetUserId: owner.id,
        targetEmail: owner.email,
        action: "owner_demote",
        previousRole: "owner",
        newRole: "admin",
        reason: reason.slice(0, 500),
      });
    }
    const [next] = await tx
      .update(users)
      .set({ adminRole: "owner", isSuperAdmin: true })
      .where(eq(users.id, target.id))
      .returning();
    await tx.insert(adminRoleEvents).values({
      actorUserId: identity.userId,
      actorLabel: identity.label,
      targetUserId: target.id,
      targetEmail: target.email,
      action: "owner_transfer",
      previousRole: targetRole,
      newRole: "owner",
      reason: reason.slice(0, 500),
    });
    return next;
  });
  return toAccount(updated);
}

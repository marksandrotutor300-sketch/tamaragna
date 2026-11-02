import { eq } from "drizzle-orm";
import { ok, withActor } from "@/lib/api";
import { requireUser } from "@/lib/db/actor";
import { getDb } from "@/lib/db/client";
import {
  emailTokens,
  profiles,
  pushSubscriptions,
  sessions,
  users,
} from "@/lib/db/schema";
import { clearSessionCookie } from "@/lib/db/session";

export const runtime = "nodejs";

export async function DELETE(): Promise<Response> {
  return withActor(async (actor) => {
    requireUser(actor);
    const db = await getDb();

    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({ userId: null })
        .where(eq(profiles.userId, actor.userId));
      await tx
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, actor.userId));
      await tx.delete(sessions).where(eq(sessions.userId, actor.userId));
      if (actor.email) {
        await tx.delete(emailTokens).where(eq(emailTokens.email, actor.email));
      }
      await tx.delete(users).where(eq(users.id, actor.userId));
    });

    await clearSessionCookie();
    return ok({ deleted: true });
  });
}

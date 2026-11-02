import { eq, ne, and } from "drizzle-orm";
import { fail, ok, withActor } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireUser } from "@/lib/db/actor";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return withActor(async (actor) => {
    requireUser(actor);
    const db = await getDb();

    if (actor.profile.userId && actor.profile.userId !== actor.userId) {
      return fail("This ranch is linked to another account", 409);
    }

    const others = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          eq(profiles.userId, actor.userId),
          ne(profiles.id, actor.profile.id),
        ),
      )
      .limit(1);

    if (others[0]) {
      return fail("This account already owns a ranch", 409);
    }

    await db
      .update(profiles)
      .set({ userId: actor.userId })
      .where(eq(profiles.id, actor.profile.id));

    return ok({ linked: true });
  });
}

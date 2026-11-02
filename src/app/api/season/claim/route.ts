import { and, eq, sql } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { profiles, seasonRewards } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:season-claim`, LIMITS.seasonClaim))) {
      return fail("Too many claims - slow down", 429);
    }

    const db = await getDb();
    const pending = await db
      .select()
      .from(seasonRewards)
      .where(
        and(
          eq(seasonRewards.profileId, profile.id),
          eq(seasonRewards.claimed, false),
        ),
      );

    if (pending.length === 0) {
      return fail("No season rewards to claim", 400);
    }

    const coins = pending.reduce((sum, reward) => sum + reward.coins, 0);
    const eggs = pending.reduce((sum, reward) => sum + reward.eggs, 0);

    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({
          coins: sql`${profiles.coins} + ${coins}`,
          eggs: sql`${profiles.eggs} + ${eggs}`,
        })
        .where(eq(profiles.id, profile.id));

      await tx
        .update(seasonRewards)
        .set({ claimed: true })
        .where(
          and(
            eq(seasonRewards.profileId, profile.id),
            eq(seasonRewards.claimed, false),
          ),
        );
    });

    return ok({ coins, eggs });
  });
}

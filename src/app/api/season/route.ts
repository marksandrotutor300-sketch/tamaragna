import { and, eq } from "drizzle-orm";
import { ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { seasonRewards } from "@/lib/db/schema";
import { PLACEMENT_MATCHES, seasonTier } from "@/lib/game/season";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const rewards = await db
      .select()
      .from(seasonRewards)
      .where(eq(seasonRewards.profileId, profile.id))
      .orderBy(seasonRewards.season);

    const unclaimed = rewards.filter((reward) => !reward.claimed);

    return ok({
      season: profile.season,
      rating: profile.rating,
      placementMatches: profile.placementMatches,
      placementsRequired: PLACEMENT_MATCHES,
      tier: seasonTier(profile.rating),
      rewards: rewards.map((reward) => ({
        season: reward.season,
        rating: reward.rating,
        tier: reward.tier,
        coins: reward.coins,
        eggs: reward.eggs,
        claimed: reward.claimed,
      })),
      unclaimed: unclaimed.reduce(
        (sum, reward) => ({
          coins: sum.coins + reward.coins,
          eggs: sum.eggs + reward.eggs,
        }),
        { coins: 0, eggs: 0 },
      ),
    });
  });
}

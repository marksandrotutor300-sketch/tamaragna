import { and, eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { profiles, pvpSnapshots, seasonRewards as seasonRewardsTable, seasons, towerRuns } from "../src/lib/db/schema";
import { seasonRewards as calculateRewards } from "../src/lib/game/season";

async function main(): Promise<void> {
  console.log("Opening the database...");
  const db = await getDb();
  const allProfiles = await db.select().from(profiles);
  const closingSeason = allProfiles.reduce(
    (highest, profile) => Math.max(highest, profile.season),
    1,
  );

  console.log(`Rolling ${allProfiles.length} profiles out of season ${closingSeason}...`);
  let awarded = 0;

  for (const profile of allProfiles) {
    const runs = await db
      .select({ highestWave: towerRuns.highestWave })
      .from(towerRuns)
      .where(
        and(
          eq(towerRuns.ownerId, profile.id),
          eq(towerRuns.season, profile.season),
        ),
      );

    const bestWave = runs.reduce(
      (highest, run) => Math.max(highest, run.highestWave),
      0,
    );
    const reward = calculateRewards(profile.rating, bestWave);

    const inserted = await db
      .insert(seasonRewardsTable)
      .values({
        profileId: profile.id,
        season: profile.season,
        rating: profile.rating,
        tier: reward.tier.name,
        coins: reward.coins,
        eggs: reward.eggs,
      })
      .onConflictDoNothing()
      .returning({ profileId: seasonRewardsTable.profileId });

    if (inserted.length > 0) awarded += 1;

    await db
      .update(profiles)
      .set({
        rating: 1000,
        placementMatches: 0,
        season: profile.season + 1,
      })
      .where(eq(profiles.id, profile.id));

    await db
      .update(pvpSnapshots)
      .set({ rating: 1000, season: profile.season + 1 })
      .where(eq(pvpSnapshots.ownerId, profile.id));
  }

  await db
    .update(towerRuns)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(towerRuns.status, "active"));

  const nextSeason = closingSeason + 1;
  await db
    .insert(seasons)
    .values({ id: nextSeason })
    .onConflictDoNothing();
  await db
    .update(seasons)
    .set({ endedAt: new Date() })
    .where(eq(seasons.id, closingSeason));

  console.log(
    `Rolled ${allProfiles.length} profiles out of season ${closingSeason}; ` +
      `awarded ${awarded} season reward rows.`,
  );
  console.log(
    `Season ${nextSeason} is open. Ratings and placements reset to 1000 / 0.`,
  );

  // The embedded PGlite worker keeps the event loop alive; this is a CLI job.
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

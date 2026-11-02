import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pvpSnapshots, type Profile } from "@/lib/db/schema";
import { loadTeamPets } from "./battles";
import { teamToCombatants } from "./team";

/**
 * Keep the player's ghost team in sync with their roster. No-op until the
 * player has entered the arena at least once, so the PvP table never becomes a
 * mirror of the whole user base.
 */
export async function refreshPvpSnapshot(profile: Profile): Promise<void> {
  const db = await getDb();
  const existing = await db
    .select({ id: pvpSnapshots.id })
    .from(pvpSnapshots)
    .where(eq(pvpSnapshots.ownerId, profile.id))
    .limit(1);

  if (!existing[0]) return;

  const teamPets = await loadTeamPets(profile.id);
  if (teamPets.length === 0) return;

  await db
    .update(pvpSnapshots)
    .set({
      team: teamToCombatants(teamPets),
      rating: profile.rating,
      season: profile.season,
      updatedAt: new Date(),
    })
    .where(eq(pvpSnapshots.ownerId, profile.id));
}

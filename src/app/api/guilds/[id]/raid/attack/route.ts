import { and, eq, sql } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  guildContributions,
  guildMembers,
  guildRaids,
  profiles,
} from "@/lib/db/schema";
import { loadTeamPets } from "@/lib/game/battles";
import { teamToCombatants } from "@/lib/game/team";
import { buildWildCombatant } from "@/lib/game/combatant";
import { getSpecies } from "@/lib/game/species";
import { simulateBattle } from "@/lib/sim/replay";
import { Rng } from "@/lib/rng";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:guild-raid`, LIMITS.guildAttack))) {
      return fail("The guild boss is resting - try again soon", 429);
    }
    const db = await getDb();
    const membership = await db
      .select()
      .from(guildMembers)
      .where(
        and(eq(guildMembers.guildId, id), eq(guildMembers.profileId, profile.id)),
      )
      .limit(1);
    if (!membership[0]) return fail("Join the guild first", 403);

    const raidRows = await db
      .select()
      .from(guildRaids)
      .where(and(eq(guildRaids.guildId, id), eq(guildRaids.status, "active")))
      .limit(1);
    const raid = raidRows[0];
    if (!raid) return fail("No active guild raid", 404);
    if (raid.endsAt.getTime() < Date.now()) {
      await db
        .update(guildRaids)
        .set({ status: "expired" })
        .where(eq(guildRaids.id, raid.id));
      return fail("This raid has expired", 400);
    }

    const team = await loadTeamPets(profile.id);
    if (team.length === 0) return fail("Put a team together first", 400);
    const teamA = teamToCombatants(team);

    const bossSpecies = getSpecies(raid.bossSpeciesId);
    if (!bossSpecies) return fail("Raid boss data unavailable", 500);
    const boss = buildWildCombatant({
      petId: `raid-${raid.id}`,
      species: bossSpecies,
      level: 60,
      rarity: 5,
      rng: new Rng(raid.id),
      statMultiplier: 1.35,
      hpMultiplier: 5,
      nature: "hardy",
      ivs: { str: 31, agi: 31, vit: 31, int: 31, dex: 31, luk: 31 },
    });

    const seed = crypto.randomUUID();
    const { result } = simulateBattle(
      {
        seed,
        teamA,
        teamB: [boss],
        ai: { a: false, b: true },
        maxMs: 120_000,
      },
      [],
    );

    const bossEnd = result.sides.b.fighters[0];
    const damage = Math.max(0, (bossEnd?.maxHp ?? 0) - (bossEnd?.hp ?? 0));
    const nextHp = Math.max(0, raid.hp - damage);
    const defeated = nextHp === 0;
    const coins = 20 + Math.floor(damage / 250) + (defeated ? 300 : 0);
    const materials = 1 + (defeated ? 20 : 0);

    const updatedRaid = await db.transaction(async (tx) => {
      const [nextRaid] = await tx
        .update(guildRaids)
        .set({ hp: nextHp, status: defeated ? "defeated" : "active" })
        .where(eq(guildRaids.id, raid.id))
        .returning();

      await tx
        .insert(guildContributions)
        .values({
          raidId: raid.id,
          profileId: profile.id,
          damage,
          attacks: 1,
        })
        .onConflictDoUpdate({
          target: [guildContributions.raidId, guildContributions.profileId],
          set: {
            damage: sql`${guildContributions.damage} + ${damage}`,
            attacks: sql`${guildContributions.attacks} + 1`,
            updatedAt: new Date(),
          },
        });

      const [nextProfile] = await tx
        .update(profiles)
        .set({
          coins: profile.coins + coins,
          materials: profile.materials + materials,
        })
        .where(eq(profiles.id, profile.id))
        .returning();

      return { raid: nextRaid, profile: nextProfile };
    });

    return ok({
      damage,
      defeated,
      winner: result.winner,
      durationMs: result.durationMs,
      rewards: { coins, materials },
      raid: updatedRaid.raid,
      profile: {
        coins: updatedRaid.profile?.coins ?? profile.coins + coins,
        materials: updatedRaid.profile?.materials ?? profile.materials + materials,
      },
    });
  });
}

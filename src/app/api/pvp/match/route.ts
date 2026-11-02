import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { pvpSnapshots, profiles } from "@/lib/db/schema";
import { createBattleRow, loadTeamPets } from "@/lib/game/battles";
import { PVP_SEARCH_RANGE } from "@/lib/game/pvp";
import { teamToCombatants } from "@/lib/game/team";
import { Rng } from "@/lib/rng";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { auto?: boolean };
  const auto = body.auto ?? true;

  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:pvp-match`, LIMITS.pvpMatch))) {
      return fail("Too many matchmaking requests - slow down", 429);
    }

    const teamPets = await loadTeamPets(profile.id);
    if (teamPets.length === 0) {
      return fail("Put at least one pet on your team first", 400);
    }

    const combatants = teamToCombatants(teamPets);
    const db = await getDb();

    await db
      .insert(pvpSnapshots)
      .values({
        ownerId: profile.id,
        rating: profile.rating,
        season: profile.season,
        team: combatants,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pvpSnapshots.ownerId,
        set: {
          rating: profile.rating,
          season: profile.season,
          team: combatants,
          updatedAt: new Date(),
        },
      });

    const baseFilter = and(
      ne(pvpSnapshots.ownerId, profile.id),
      eq(pvpSnapshots.season, profile.season),
    );

    const nearCandidates = await db
      .select({ snapshot: pvpSnapshots, displayName: profiles.displayName })
      .from(pvpSnapshots)
      .innerJoin(profiles, eq(pvpSnapshots.ownerId, profiles.id))
      .where(
        and(
          baseFilter,
          gte(pvpSnapshots.rating, profile.rating - PVP_SEARCH_RANGE),
          lte(pvpSnapshots.rating, profile.rating + PVP_SEARCH_RANGE),
        ),
      )
      .orderBy(sql`abs(${pvpSnapshots.rating} - ${profile.rating})`)
      .limit(10);

    // Widen rather than leaving a player with no opponent at all.
    const candidates = nearCandidates.length > 0
      ? nearCandidates
      : await db
          .select({ snapshot: pvpSnapshots, displayName: profiles.displayName })
          .from(pvpSnapshots)
          .innerJoin(profiles, eq(pvpSnapshots.ownerId, profiles.id))
          .where(baseFilter)
          .orderBy(sql`abs(${pvpSnapshots.rating} - ${profile.rating})`)
          .limit(10);

    if (candidates.length === 0) {
      return fail("No opponents yet - invite a friend and check back", 404);
    }

    const rng = new Rng(crypto.randomUUID());
    const opponent = rng.pick(candidates.slice(0, 5));
    const seed = crypto.randomUUID();

    const payload = {
      teamA: combatants,
      teamB: opponent.snapshot.team,
      ai: { a: auto, b: true },
    };

    const battle = await createBattleRow({
      ownerId: profile.id,
      mode: "pvp",
      seed,
      payload,
      opponentSnapshotId: opponent.snapshot.id,
    });

    return ok({
      battleId: battle.id,
      mode: "pvp",
      seed,
      payload,
      opponent: {
        displayName: opponent.displayName,
        rating: opponent.snapshot.rating,
      },
    });
  });
}

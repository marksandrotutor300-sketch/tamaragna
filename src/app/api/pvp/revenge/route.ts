import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battles, pvpSnapshots } from "@/lib/db/schema";
import { featureUnavailable } from "@/lib/features";
import { createBattleRow, loadTeamPets } from "@/lib/game/battles";
import { teamToCombatants } from "@/lib/game/team";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  battleId: z.string().uuid(),
  auto: z.boolean().default(true),
});

export async function POST(request: Request): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:revenge`, LIMITS.revenge))) {
      return fail("Too many revenge requests - slow down", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const battleRows = await db
      .select()
      .from(battles)
      .where(eq(battles.id, parsed.data.battleId))
      .limit(1);
    const battle = battleRows[0];
    if (!battle || battle.status !== "complete") {
      return fail("That duel is not available for revenge", 404);
    }
    if (!battle.opponentSnapshotId) {
      return fail("That duel has no defender snapshot", 400);
    }

    const ownSnapshot = await db
      .select({ id: pvpSnapshots.id })
      .from(pvpSnapshots)
      .where(
        and(
          eq(pvpSnapshots.id, battle.opponentSnapshotId),
          eq(pvpSnapshots.ownerId, profile.id),
        ),
      )
      .limit(1);
    if (!ownSnapshot[0]) {
      return fail("That duel was not defended by this ranch", 403);
    }

    const attackerSnapshotRows = await db
      .select()
      .from(pvpSnapshots)
      .where(eq(pvpSnapshots.ownerId, battle.ownerId))
      .limit(1);
    const attackerSnapshot = attackerSnapshotRows[0];
    if (!attackerSnapshot) {
      return fail("That trainer has no arena snapshot yet", 404);
    }

    const teamPets = await loadTeamPets(profile.id);
    if (teamPets.length === 0) {
      return fail("Put at least one pet on your team first", 400);
    }
    const teamA = teamToCombatants(teamPets);

    await db
      .insert(pvpSnapshots)
      .values({
        ownerId: profile.id,
        rating: profile.rating,
        season: profile.season,
        team: teamA,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pvpSnapshots.ownerId,
        set: {
          rating: profile.rating,
          season: profile.season,
          team: teamA,
          updatedAt: new Date(),
        },
      });

    const seed = crypto.randomUUID();
    const created = await createBattleRow({
      ownerId: profile.id,
      mode: "pvp",
      seed,
      payload: {
        teamA,
        teamB: attackerSnapshot.team,
        ai: { a: parsed.data.auto, b: true },
      },
      opponentSnapshotId: attackerSnapshot.id,
    });

    return ok({ battleId: created.id });
  });
}

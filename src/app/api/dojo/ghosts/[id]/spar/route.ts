import { eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  battles,
  dojoGhosts,
  dojoRuns,
  profiles,
} from "@/lib/db/schema";
import { createBattleRow, grantBattleRewards, loadTeamPets } from "@/lib/game/battles";
import { recordSkillMastery } from "@/lib/game/mastery";
import { recordBattleComplete } from "@/lib/game/telemetry";
import { teamToCombatants } from "@/lib/game/team";
import { simulateBattle } from "@/lib/sim/replay";
import { petView } from "@/lib/game/views";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:dojo-spar`, LIMITS.dojoSpar))) {
      return fail("The dojo is busy - try again shortly", 429);
    }
    const db = await getDb();
    const ghostRows = await db
      .select()
      .from(dojoGhosts)
      .where(eq(dojoGhosts.id, id))
      .limit(1);
    const ghost = ghostRows[0];
    if (!ghost) return fail("Ghost not found", 404);

    const members = await loadTeamPets(profile.id);
    if (members.length === 0) return fail("Put a team together first", 400);
    const teamA = teamToCombatants(members);
    const seed = crypto.randomUUID();
    const payload = {
      teamA,
      teamB: ghost.team,
      ai: { a: false, b: true },
      maxMs: 120_000,
    };
    const battle = await createBattleRow({
      ownerId: profile.id,
      mode: "dojo",
      seed,
      payload,
    });
    const { result, events } = simulateBattle(
      { seed, ...payload },
      [],
    );

    await db
      .update(battles)
      .set({
        status: "complete",
        inputLog: [],
        result,
        resultHash: result.checksum,
        completedAt: new Date(),
      })
      .where(eq(battles.id, battle.id));

    const won = result.winner === "a";
    const coins = won ? 120 : 35;
    const rewards = await grantBattleRewards(
      profile,
      teamA.map((combatant) => combatant.petId),
      coins,
      won ? 30 : 8,
    );
    await recordSkillMastery(teamA, events, "a");
    await recordBattleComplete({
      battle: {
        id: battle.id,
        ownerId: profile.id,
        mode: "dojo",
        payload,
        result,
      },
      season: profile.season,
    });

    await db.transaction(async (tx) => {
      await tx.insert(dojoRuns).values({
        profileId: profile.id,
        ghostId: ghost.id,
        winner: won ? "a" : "b",
        battleId: battle.id,
      });
      await tx
        .update(dojoGhosts)
        .set(
          won
            ? { losses: ghost.losses + 1 }
            : { wins: ghost.wins + 1 },
        )
        .where(eq(dojoGhosts.id, ghost.id));
    });

    const ghostSpecies = ghost.team[0]?.speciesId ?? 1002;
    return ok({
      winner: result.winner,
      battleId: battle.id,
      coins: rewards.profile.coins,
      ghost: {
        id: ghost.id,
        name: ghost.name,
        speciesId: ghostSpecies,
        wins: ghost.wins + (won ? 0 : 1),
        losses: ghost.losses + (won ? 1 : 0),
      },
      pet: petView(members[0]),
    });
  });
}

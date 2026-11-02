import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  battles,
  profiles,
  pvpSnapshots,
  towerRuns,
  type TowerTeamState,
} from "@/lib/db/schema";
import { grantBattleRewards } from "@/lib/game/battles";
import { eloDelta } from "@/lib/game/pvp";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { recordQuestEventSafe } from "@/lib/game/quest-service";
import { recordBattleComplete } from "@/lib/game/telemetry";
import { recordSkillMastery } from "@/lib/game/mastery";
import { PLACEMENT_MATCHES, placementK } from "@/lib/game/season";
import { carryOverHp, waveRewards } from "@/lib/game/tower";
import { verifyBattle } from "@/lib/sim/replay";

export const runtime = "nodejs";

const SUBMIT_COOLDOWN_MS = 2000;

const inputSchema = z.union([
  z.object({
    t: z.number().min(0),
    kind: z.literal("skill"),
    index: z.number().int().min(0).max(3),
  }),
  z.object({
    t: z.number().min(0),
    kind: z.literal("swap"),
    index: z.number().int().min(0).max(2),
  }),
]);

const schema = z.object({
  inputLog: z.array(inputSchema).max(3000),
  resultHash: z.string().min(1).max(64),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const found = await db
      .select()
      .from(battles)
      .where(and(eq(battles.id, id), eq(battles.ownerId, profile.id)))
      .limit(1);

    const battle = found[0];
    if (!battle) return fail("Battle not found", 404);
    if (battle.status !== "pending") return fail("Battle already resolved", 409);

    if (
      profile.lastBattleAt &&
      Date.now() - new Date(profile.lastBattleAt).getTime() < SUBMIT_COOLDOWN_MS
    ) {
      return fail("Slow down a little", 429);
    }

    const verification = verifyBattle(
      {
        seed: battle.seed,
        teamA: battle.payload.teamA,
        teamB: battle.payload.teamB,
        ai: battle.payload.ai,
        maxMs: battle.payload.maxMs,
      },
      parsed.data.inputLog,
      parsed.data.resultHash,
    );

    if (!verification.ok) return fail("Battle verification failed", 400);

    const result = verification.result;
    const petIds = battle.payload.teamA.map((combatant) => combatant.petId);
    const survived = result.winner === "a";

    let rewards = { coins: 0, exp: 0, eggs: 0 };
    let towerWave: number | null = null;

    if (battle.mode === "tower") {
      if (!battle.towerRunId) return fail("Battle is missing its tower run", 500);

      const runRows = await db
        .select()
        .from(towerRuns)
        .where(and(eq(towerRuns.id, battle.towerRunId), eq(towerRuns.ownerId, profile.id)))
        .limit(1);

      const run = runRows[0];
      if (!run) return fail("Tower run not found", 404);
      if (run.status !== "active") return fail("Tower run already ended", 409);

      const wave = battle.payload.wave ?? run.wave + 1;
      if (wave !== run.wave + 1) return fail("Unexpected tower wave", 409);

      towerWave = wave;
      const carried = carryOverHp(battle.payload.teamA, result.sides);

      if (survived) {
        const waveResult = waveRewards(wave);
        rewards = { coins: waveResult.coins, exp: waveResult.exp, eggs: waveResult.eggs };
      }

      await db
        .update(towerRuns)
        .set({
          wave,
          highestWave: Math.max(run.highestWave, survived ? wave : wave - 1),
          teamState: { combatants: carried } satisfies TowerTeamState,
          elapsedMs: run.elapsedMs + result.durationMs,
          status: survived ? "active" : "ended",
          endedAt: survived ? null : new Date(),
        })
        .where(eq(towerRuns.id, run.id));
    } else if (battle.mode === "pvp") {
      rewards = { coins: survived ? 60 : 20, exp: survived ? 40 : 15, eggs: 0 };

      if (battle.opponentSnapshotId) {
        const snapshotRows = await db
          .select()
          .from(pvpSnapshots)
          .where(eq(pvpSnapshots.id, battle.opponentSnapshotId))
          .limit(1);
        const snapshot = snapshotRows[0];

        if (snapshot) {
          const score = result.winner === "a" ? 1 : result.winner === "b" ? 0 : 0.5;
          const delta = eloDelta(
            profile.rating,
            snapshot.rating,
            score as 0 | 0.5 | 1,
            placementK(profile.placementMatches),
          );
          const placementMatches = Math.min(
            PLACEMENT_MATCHES,
            profile.placementMatches + 1,
          );

          await db
            .update(profiles)
            .set({
              rating: Math.max(100, profile.rating + delta),
              placementMatches,
            })
            .where(eq(profiles.id, profile.id));

          const defenderRating = Math.max(100, snapshot.rating - delta);
          await db
            .update(profiles)
            .set({ rating: defenderRating })
            .where(eq(profiles.id, snapshot.ownerId));

          await db
            .update(pvpSnapshots)
            .set({ rating: defenderRating, updatedAt: new Date() })
            .where(eq(pvpSnapshots.id, snapshot.id));

          await db
            .update(pvpSnapshots)
            .set({ rating: Math.max(100, profile.rating + delta), updatedAt: new Date() })
            .where(eq(pvpSnapshots.ownerId, profile.id));
        }
      }
    } else {
      rewards = survived
        ? { coins: 25, exp: 30, eggs: 0 }
        : { coins: 8, exp: 10, eggs: 0 };
    }

    const reward = await grantBattleRewards(
      profile,
      petIds,
      rewards.coins,
      rewards.exp,
      rewards.eggs,
    );

    await db
      .update(battles)
      .set({
        status: "complete",
        inputLog: parsed.data.inputLog,
        result,
        resultHash: result.checksum,
        completedAt: new Date(),
      })
      .where(eq(battles.id, battle.id));

    await recordBattleComplete({
      battle: { ...battle, result },
      season: profile.season,
    });

    try {
      await recordSkillMastery(battle.payload.teamA, verification.events);
    } catch (error) {
      console.error("[mastery]", error);
    }

    if (survived) {
      await recordQuestEventSafe(profile.id, "battle_win", 1);
      if (battle.mode === "tower") {
        await recordQuestEventSafe(profile.id, "tower_wave", 1);
      }
    }

    const fresh = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profile.id))
      .limit(1);

    const current = fresh[0] ?? reward.profile;

    // Level-ups and rating changes make the ghost team stale.
    await refreshPvpSnapshot(current);

    return ok({
      result,
      survived,
      towerWave,
      rewards,
      levelUps: reward.levelUps,
      profile: {
        coins: current.coins,
        eggs: current.eggs,
        rating: current.rating,
        placementMatches: current.placementMatches,
      },
    });
  });
}

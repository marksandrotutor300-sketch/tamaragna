import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { battles, towerRuns, type TowerRun, type TowerTeamState } from "@/lib/db/schema";
import { createBattleRow } from "./battles";
import { buildWave, healTeam, type Wave } from "./tower";

export type WaveBattle = {
  battle: typeof battles.$inferSelect;
  wave: Wave;
};

/**
 * Return the pending battle for this run if one exists, otherwise heal and
 * generate the next wave. Keeping this idempotent means a page reload never
 * spends a wave twice.
 */
export async function ensureWaveBattle(run: TowerRun, auto = true): Promise<WaveBattle | null> {
  const db = await getDb();
  const teamLevel = Math.max(
    1,
    Math.round(
      run.teamState.combatants.reduce((sum, combatant) => sum + combatant.level, 0) /
        Math.max(1, run.teamState.combatants.length),
    ),
  );

  const pending = await db
    .select()
    .from(battles)
    .where(and(eq(battles.towerRunId, run.id), eq(battles.status, "pending")))
    .limit(1);

  if (pending[0]) {
    const wave = pending[0].payload.wave ?? run.wave + 1;
    const waveData = buildWave(run.seed, wave, teamLevel);

    // The player can flip auto/manual before starting a wave. Apply it to the
    // pending battle so the toggle is authoritative without rerolling the wave.
    const desiredAi = { a: auto, b: true };
    if (pending[0].payload.ai.a !== desiredAi.a) {
      const payload = { ...pending[0].payload, ai: desiredAi };
      await db.update(battles).set({ payload }).where(eq(battles.id, pending[0].id));
      return { battle: { ...pending[0], payload }, wave: waveData };
    }

    return { battle: pending[0], wave: waveData };
  }

  const wave = run.wave + 1;
  if (wave > 999) return null;

  const healed = healTeam(run.teamState.combatants);
  const waveData = buildWave(run.seed, wave, teamLevel);

  const battle = await createBattleRow({
    ownerId: run.ownerId,
    mode: "tower",
    seed: waveData.seed,
    towerRunId: run.id,
    payload: {
      teamA: healed,
      teamB: waveData.enemies,
      ai: { a: auto, b: true },
      wave,
    },
  });

  await db
    .update(towerRuns)
    .set({ teamState: { combatants: healed } satisfies TowerTeamState })
    .where(eq(towerRuns.id, run.id));

  return { battle, wave: waveData };
}

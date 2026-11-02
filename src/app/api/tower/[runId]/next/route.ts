import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battles, towerRuns } from "@/lib/db/schema";
import { applyBlessing, draftOptions } from "@/lib/game/blessings";
import { ensureWaveBattle } from "@/lib/game/tower-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    auto?: boolean;
    blessingId?: string;
  };
  const auto = body.auto ?? true;

  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(towerRuns)
      .where(and(eq(towerRuns.id, runId), eq(towerRuns.ownerId, profile.id)))
      .limit(1);

    const run = rows[0];
    if (!run) return fail("Run not found", 404);
    if (run.status !== "active") return fail("This run has ended", 409);

    const pending = await db
      .select({ id: battles.id })
      .from(battles)
      .where(and(eq(battles.towerRunId, run.id), eq(battles.status, "pending")))
      .limit(1);

    let currentRun = run;

    // A pending battle was generated before the draft, so a late blessing
    // cannot retroactively apply to it. The UI only sends one when unpending.
    if (!pending[0] && body.blessingId) {
      const options = draftOptions(run.seed, run.wave + 1);
      const blessing = options.find((entry) => entry.id === body.blessingId);
      if (!blessing) return fail("That blessing is not available", 400);

      const alreadyApplied = run.blessings.some(
        (entry) => entry.wave === run.wave + 1,
      );

      if (!alreadyApplied) {
        const combatants = applyBlessing(run.teamState.combatants, blessing);
        const updated = await db
          .update(towerRuns)
          .set({
            teamState: { combatants },
            blessings: [...run.blessings, { wave: run.wave + 1, id: blessing.id }],
          })
          .where(eq(towerRuns.id, run.id))
          .returning();
        currentRun = updated[0] ?? run;
      }
    }

    const next = await ensureWaveBattle(currentRun, auto);
    if (!next) return fail("Tower complete", 409);

    return ok({
      run: {
        id: currentRun.id,
        wave: next.wave.wave,
        highestWave: currentRun.highestWave,
        status: currentRun.status,
      },
      battle: {
        battleId: next.battle.id,
        seed: next.battle.seed,
        payload: next.battle.payload,
        boss: next.wave.boss,
      },
    });
  });
}

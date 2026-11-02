import { and, desc, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { towerRuns } from "@/lib/db/schema";
import { loadTeamPets } from "@/lib/game/battles";
import { teamToCombatants } from "@/lib/game/team";
import { ensureWaveBattle } from "@/lib/game/tower-service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { auto?: boolean };
  const auto = body.auto ?? true;

  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:tower-start`, LIMITS.towerStart))) {
      return fail("Too many tower starts - slow down", 429);
    }

    const db = await getDb();

    const activeRows = await db
      .select()
      .from(towerRuns)
      .where(and(eq(towerRuns.ownerId, profile.id), eq(towerRuns.status, "active")))
      .orderBy(desc(towerRuns.startedAt))
      .limit(1);

    let run = activeRows[0];

    if (!run) {
      const teamPets = await loadTeamPets(profile.id);
      if (teamPets.length === 0) {
        return fail("Put at least one pet on your team first", 400);
      }

      const combatants = teamToCombatants(teamPets);
      const inserted = await db
        .insert(towerRuns)
        .values({
          ownerId: profile.id,
          seed: crypto.randomUUID(),
          wave: 0,
          highestWave: 0,
          teamState: { combatants },
          status: "active",
          season: profile.season,
        })
        .returning();
      run = inserted[0];
    }

    const next = await ensureWaveBattle(run, auto);
    if (!next) {
      return ok({
        run: { id: run.id, wave: run.wave, highestWave: run.highestWave },
        battle: null,
      });
    }

    return ok({
      run: {
        id: run.id,
        wave: next.wave.wave,
        highestWave: run.highestWave,
        status: run.status,
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

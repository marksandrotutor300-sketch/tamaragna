import { and, asc, desc, eq } from "drizzle-orm";
import { ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles, towerRuns } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();

    const active = await db
      .select()
      .from(towerRuns)
      .where(and(eq(towerRuns.ownerId, profile.id), eq(towerRuns.status, "active")))
      .orderBy(desc(towerRuns.startedAt))
      .limit(1);

    const best = await db
      .select()
      .from(towerRuns)
      .where(and(eq(towerRuns.ownerId, profile.id), eq(towerRuns.status, "ended")))
      .orderBy(desc(towerRuns.highestWave), asc(towerRuns.elapsedMs))
      .limit(1);

    const entries = await db
      .select({
        displayName: profiles.displayName,
        highestWave: towerRuns.highestWave,
        elapsedMs: towerRuns.elapsedMs,
        endedAt: towerRuns.endedAt,
      })
      .from(towerRuns)
      .innerJoin(profiles, eq(towerRuns.ownerId, profiles.id))
      .where(eq(towerRuns.status, "ended"))
      .orderBy(desc(towerRuns.highestWave), asc(towerRuns.elapsedMs))
      .limit(50);

    return ok({
      activeRun: active[0]
        ? {
            id: active[0].id,
            wave: active[0].wave,
            nextWave: active[0].wave + 1,
            highestWave: active[0].highestWave,
            elapsedMs: active[0].elapsedMs,
          }
        : null,
      best: best[0]
        ? { highestWave: best[0].highestWave, elapsedMs: best[0].elapsedMs }
        : null,
      leaderboard: entries.map((entry, index) => ({
        rank: index + 1,
        displayName: entry.displayName,
        highestWave: entry.highestWave,
        elapsedMs: entry.elapsedMs,
      })),
    });
  });
}

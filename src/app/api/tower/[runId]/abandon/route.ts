import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { towerRuns } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await context.params;

  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(towerRuns)
      .where(and(eq(towerRuns.id, runId), eq(towerRuns.ownerId, profile.id)))
      .limit(1);

    const run = rows[0];
    if (!run) return fail("Run not found", 404);
    if (run.status !== "active") return fail("This run already ended", 409);

    const updated = await db
      .update(towerRuns)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(towerRuns.id, run.id))
      .returning();

    return ok({
      run: {
        id: run.id,
        highestWave: updated[0]?.highestWave ?? run.highestWave,
        elapsedMs: updated[0]?.elapsedMs ?? run.elapsedMs,
      },
    });
  });
}

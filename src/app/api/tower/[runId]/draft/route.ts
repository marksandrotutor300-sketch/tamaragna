import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battles, towerRuns } from "@/lib/db/schema";
import { draftOptions, blessingById } from "@/lib/game/blessings";

export const runtime = "nodejs";

export async function GET(
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
    if (run.status !== "active") return fail("This run has ended", 409);

    const pending = await db
      .select({ id: battles.id })
      .from(battles)
      .where(and(eq(battles.towerRunId, run.id), eq(battles.status, "pending")))
      .limit(1);

    const wave = run.wave + 1;

    return ok({
      pending: Boolean(pending[0]),
      wave,
      options: pending[0]
        ? []
        : draftOptions(run.seed, wave).map((blessing) => ({
            id: blessing.id,
            name: blessing.name,
            description: blessing.description,
          })),
      blessings: run.blessings.map((entry) => ({
        ...entry,
        name: blessingById(entry.id)?.name ?? entry.id,
      })),
    });
  });
}

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { liveMatches, spectatorPicks } from "@/lib/db/schema";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const db = await getDb();
  const rows = await db
    .select()
    .from(spectatorPicks)
    .where(eq(spectatorPicks.matchId, id));
  let a = 0;
  let b = 0;
  for (const row of rows) {
    if (row.pickId) {
      // Counts are resolved against the match below so a pick id cannot leak an
      // arbitrary profile into the crowd split.
      void row;
    }
  }
  const matchRows = await db
    .select()
    .from(liveMatches)
    .where(eq(liveMatches.id, id))
    .limit(1);
  const match = matchRows[0];
  if (match) {
    for (const row of rows) {
      if (row.pickId === match.playerA) a += 1;
      if (row.pickId === match.playerB) b += 1;
    }
  }
  return ok({ a, b, total: a + b });
}

const schema = z.object({
  pickId: z.string().uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:spectator-pick`,
        LIMITS.spectatorPick,
      ))
    ) {
      return fail("Too many picks", 429);
    }
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const matchRows = await db
      .select()
      .from(liveMatches)
      .where(and(eq(liveMatches.id, id), eq(liveMatches.status, "active")))
      .limit(1);
    const match = matchRows[0];
    if (!match) return fail("Match is not open for picks", 404);
    if (match.playerA === profile.id || match.playerB === profile.id) {
      return fail("Players cannot pick their own match", 400);
    }
    if (parsed.data.pickId !== match.playerA && parsed.data.pickId !== match.playerB) {
      return fail("Pick one of the two players", 400);
    }

    await db
      .insert(spectatorPicks)
      .values({
        matchId: id,
        voterId: profile.id,
        pickId: parsed.data.pickId,
      })
      .onConflictDoUpdate({
        target: [spectatorPicks.matchId, spectatorPicks.voterId],
        set: { pickId: parsed.data.pickId, correct: null, points: 0 },
      });

    return ok({ picked: true });
  });
}

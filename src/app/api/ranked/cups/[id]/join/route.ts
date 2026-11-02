import { eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { rankedCups } from "@/lib/db/schema";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { joinTournament } from "@/lib/tournaments";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:ranked-join`, LIMITS.rankedJoin))) {
      return fail("Too many circuit actions", 429);
    }
    const db = await getDb();
    const rows = await db
      .select()
      .from(rankedCups)
      .where(eq(rankedCups.id, id))
      .limit(1);
    if (!rows[0]) return fail("Cup not found", 404);
    try {
      await joinTournament(rows[0].tournamentId, profile.id);
      return ok({ joined: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not join", 400);
    }
  });
}

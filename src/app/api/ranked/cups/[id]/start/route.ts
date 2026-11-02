import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { rankedCups, tournamentEntries } from "@/lib/db/schema";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { startTournament } from "@/lib/tournaments";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:ranked-start`, LIMITS.rankedJoin))) {
      return fail("Too many circuit actions", 429);
    }
    const db = await getDb();
    const rows = await db
      .select()
      .from(rankedCups)
      .where(eq(rankedCups.id, id))
      .limit(1);
    const cup = rows[0];
    if (!cup) return fail("Cup not found", 404);

    const entry = await db
      .select({ profileId: tournamentEntries.profileId })
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, cup.tournamentId),
          eq(tournamentEntries.profileId, profile.id),
        ),
      )
      .limit(1);
    if (!entry[0]) return fail("Join the cup first", 403);

    try {
      await startTournament(cup.tournamentId);
      await db
        .update(rankedCups)
        .set({ status: "active" })
        .where(eq(rankedCups.id, cup.id));
      return ok({ started: true, tournamentId: cup.tournamentId });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not start", 400);
    }
  });
}

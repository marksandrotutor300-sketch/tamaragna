import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { tournamentEntries } from "@/lib/db/schema";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { startTournament } from "@/lib/tournaments";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;
  const { id } = await context.params;

  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:tournament-start`,
        LIMITS.tournamentStart,
      ))
    ) {
      return fail("Too many tournament actions", 429);
    }

    const db = await getDb();
    const entry = await db
      .select({ profileId: tournamentEntries.profileId })
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, id),
          eq(tournamentEntries.profileId, profile.id),
        ),
      )
      .limit(1);
    if (!entry[0]) return fail("Join the tournament first", 403);

    try {
      return ok(await startTournament(id));
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not start", 400);
    }
  });
}

import { fail, ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { startTournamentMatch } from "@/lib/tournaments";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; matchId: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;
  const { id, matchId } = await context.params;

  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:tournament-match`,
        LIMITS.tournamentStart,
      ))
    ) {
      return fail("Too many tournament actions", 429);
    }
    try {
      const result = await startTournamentMatch(id, matchId, profile.id);
      return ok(result);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Could not start the match",
        400,
      );
    }
  });
}

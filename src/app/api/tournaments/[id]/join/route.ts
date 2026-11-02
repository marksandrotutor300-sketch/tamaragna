import { fail, ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { joinTournament } from "@/lib/tournaments";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

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
        `${profile.id}:tournament-join`,
        LIMITS.tournamentJoin,
      ))
    ) {
      return fail("Too many tournament actions", 429);
    }
    try {
      return ok(await joinTournament(id, profile.id));
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not join", 400);
    }
  });
}

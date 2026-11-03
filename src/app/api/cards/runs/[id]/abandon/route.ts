import { fail, ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { abandonCardRun } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  const { id } = await params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-abandon`, LIMITS.cardsAbandon))) {
      return fail("Slow down.", 429);
    }
    try {
      return ok({ run: await abandonCardRun(profile.id, id) });
    } catch (error) {
      return cardError(error);
    }
  });
}

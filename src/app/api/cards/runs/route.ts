import { fail, ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { startCardRun } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-start`, LIMITS.cardsStart))) {
      return fail("Slow down.", 429);
    }
    try {
      return ok({ run: await startCardRun(profile) }, 201);
    } catch (error) {
      return cardError(error);
    }
  });
}

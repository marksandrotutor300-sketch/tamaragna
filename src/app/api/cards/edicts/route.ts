import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { purchaseEdict } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

const schema = z.object({ id: z.string().min(1).max(80) });

export async function POST(request: Request): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-edicts`, LIMITS.cardsEdicts))) {
      return fail("Slow down.", 429);
    }
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;
    try {
      return ok(await purchaseEdict(profile, parsed.data.id));
    } catch (error) {
      return cardError(error);
    }
  });
}

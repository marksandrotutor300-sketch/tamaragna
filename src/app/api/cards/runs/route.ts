import { z } from "zod";
import { fail, ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { startCardRun } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

const schema = z.object({
  ascension: z.number().int().min(0).max(5).optional(),
  path: z.string().min(1).max(40).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-start`, LIMITS.cardsStart))) {
      return fail("Slow down.", 429);
    }
    let body: unknown = {};
    const raw = await request.text();
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        return fail("Invalid JSON body", 400);
      }
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request", 422);
    }
    try {
      return ok({ run: await startCardRun(profile, parsed.data) }, 201);
    } catch (error) {
      return cardError(error);
    }
  });
}

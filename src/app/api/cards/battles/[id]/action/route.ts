import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { actOnCardBattle } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("playCard"),
    instanceId: z.string().min(1).max(120),
    targetId: z.string().min(1).max(120).optional(),
  }),
  z.object({ kind: z.literal("endTurn") }),
]);

const schema = z.object({
  version: z.number().int().min(0),
  action: actionSchema,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  const { id } = await params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-action`, LIMITS.cardsAction))) {
      return fail("Slow down.", 429);
    }
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;
    try {
      return ok(await actOnCardBattle(profile, id, parsed.data.version, parsed.data.action));
    } catch (error) {
      return cardError(error);
    }
  });
}

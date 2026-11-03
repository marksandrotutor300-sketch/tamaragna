import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { resolveShop } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("leave") }),
  z.object({
    action: z.literal("buy"),
    kind: z.enum(["card", "relic"]),
    id: z.string().min(1).max(160),
  }),
  z.object({ action: z.literal("remove"), instanceId: z.string().min(1).max(120) }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  const { id } = await params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-shop`, LIMITS.cardsShop))) {
      return fail("Slow down.", 429);
    }
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;
    try {
      return ok({ run: await resolveShop(profile.id, id, parsed.data) });
    } catch (error) {
      return cardError(error);
    }
  });
}

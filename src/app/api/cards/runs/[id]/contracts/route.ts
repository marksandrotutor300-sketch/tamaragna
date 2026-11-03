import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { claimContract } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

const schema = z.object({ contractId: z.string().min(1).max(80) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  const { id } = await params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:cards-contracts`, LIMITS.cardsContracts))) {
      return fail("Slow down.", 429);
    }
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;
    try {
      return ok({ run: await claimContract(profile.id, id, parsed.data.contractId) });
    } catch (error) {
      return cardError(error);
    }
  });
}

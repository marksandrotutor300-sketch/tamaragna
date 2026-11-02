import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { claimLoginReward, claimQuestReward, getQuestSummary } from "@/lib/game/quest-service";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["daily", "weekly", "login"]),
  id: z.string().min(1).max(40).optional(),
});

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:quest-claim`, LIMITS.questClaim))) {
      return fail("Too many claims - slow down", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const { kind, id } = parsed.data;
    const reward =
      kind === "login"
        ? await claimLoginReward(profile.id)
        : id
          ? await claimQuestReward(profile.id, kind, id)
          : null;

    if (!reward) {
      return fail("Quest is not complete or has already been claimed", 400);
    }

    return ok({
      reward,
      summary: await getQuestSummary(profile.id),
    });
  });
}

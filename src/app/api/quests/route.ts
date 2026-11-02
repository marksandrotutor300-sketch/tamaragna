import { ok, withUser } from "@/lib/api";
import { getQuestSummary } from "@/lib/game/quest-service";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    return ok(await getQuestSummary(profile.id));
  });
}

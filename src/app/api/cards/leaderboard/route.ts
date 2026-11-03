import { ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { getCardLeaderboard } from "@/lib/game/card-run-service";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  return withUser(async () => ok({ leaderboard: await getCardLeaderboard(50) }));
}

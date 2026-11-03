import { ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { getCardRunHub } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  return withUser(async (profile) => {
    try {
      return ok(await getCardRunHub(profile.id));
    } catch (error) {
      return cardError(error);
    }
  });
}

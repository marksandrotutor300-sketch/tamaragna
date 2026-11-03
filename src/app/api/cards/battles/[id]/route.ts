import { ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { loadCardBattleView } from "@/lib/game/card-run-service";
import { cardError } from "@/lib/cards/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("cards");
  if (disabled) return disabled;
  const { id } = await params;
  return withUser(async (profile) => {
    try {
      return ok({ battle: await loadCardBattleView(profile.id, id) });
    } catch (error) {
      return cardError(error);
    }
  });
}

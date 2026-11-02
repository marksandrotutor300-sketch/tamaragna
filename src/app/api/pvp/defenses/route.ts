import { ok, withUser } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { getDefenseLog } from "@/lib/game/defenses";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  return withUser(async (profile) => {
    const battles = await getDefenseLog(profile.id);
    return ok({ battles });
  });
}

import { fail } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { getReplayByToken } from "@/lib/game/replays";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  const { token } = await context.params;
  const replay = await getReplayByToken(token);
  if (!replay) return fail("Replay not found", 404);

  return Response.json(replay, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

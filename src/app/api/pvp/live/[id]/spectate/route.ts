import { eq } from "drizzle-orm";
import { fail, ok } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { liveMatches } from "@/lib/db/schema";
import { featureUnavailable } from "@/lib/features";
import { getLiveRoom } from "@/lib/live/rooms";
import { signLiveTicket } from "@/lib/live/ticket";
import { checkRateLimit, clientKey, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  if (
    !(await checkRateLimit(
      `${clientKey(request)}:live-spectate`,
      LIMITS.liveSpectate,
    ))
  ) {
    return fail("Too many spectate requests", 429);
  }

  const { id } = await context.params;
  const room = getLiveRoom(id);
  if (!room) return fail("Match is not available for spectating", 404);

  const db = await getDb();
  const rows = await db
    .select({ id: liveMatches.id })
    .from(liveMatches)
    .where(eq(liveMatches.id, id))
    .limit(1);
  if (!rows[0]) return fail("Match not found", 404);

  return ok({
    ticket: signLiveTicket({
      matchId: id,
      profileId: null,
      seat: "spectator",
      spectator: true,
    }),
  });
}

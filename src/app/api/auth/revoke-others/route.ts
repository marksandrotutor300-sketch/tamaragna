import { ok, withActor } from "@/lib/api";
import { requireUser } from "@/lib/db/actor";
import { revokeOtherSessions } from "@/lib/db/session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return withActor(async (actor) => {
    requireUser(actor);
    await revokeOtherSessions(actor.userId, actor.sessionId);
    return ok({ revoked: true });
  });
}

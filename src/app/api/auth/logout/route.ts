import { ok, withActor } from "@/lib/api";
import { clearSessionCookie, revokeSession } from "@/lib/db/session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return withActor(async (actor) => {
    if (actor.sessionId) await revokeSession(actor.sessionId);
    await clearSessionCookie();
    return ok({ signedOut: true });
  });
}

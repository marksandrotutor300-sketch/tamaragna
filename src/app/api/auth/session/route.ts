import { ok, withActor } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withActor(async (actor) =>
    ok({
      authenticated: actor.authenticated,
      email: actor.email,
      profileId: actor.profile.id,
    }),
  );
}

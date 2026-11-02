import { getAdminIdentity } from "@/lib/admin";
import { adminFailure, searchPlayers } from "@/lib/admin/service";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return ok({ players: await searchPlayers(query) });
  } catch (error) {
    return adminFailure(error);
  }
}

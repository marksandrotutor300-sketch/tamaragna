import { getAdminIdentity } from "@/lib/admin";
import { adminFailure } from "@/lib/admin/service";
import { fail, ok } from "@/lib/api";
import { ALL_SUMMARIES } from "@/lib/game/species";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  try {
    const matches = query
      ? ALL_SUMMARIES.filter(
          (species) =>
            species.name.toLowerCase().includes(query) ||
            String(species.id) === query,
        )
      : ALL_SUMMARIES;
    return ok({ species: matches.slice(0, 20) });
  } catch (error) {
    return adminFailure(error);
  }
}

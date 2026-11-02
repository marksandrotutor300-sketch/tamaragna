import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { HABITATS, getHabitat } from "@/lib/game/habitats";

export const runtime = "nodejs";

const schema = z.object({
  habitat: z.string().min(1).max(24),
});

export async function PATCH(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;
    const habitat = getHabitat(parsed.data.habitat);
    if (!HABITATS.some((entry) => entry.id === habitat.id)) {
      return fail("Unknown habitat", 404);
    }
    if (profile.habitat === habitat.id) return ok({ habitat: habitat.id });

    if (profile.materials < habitat.cost) {
      return fail(`This habitat needs ${habitat.cost} materials`, 400);
    }

    const db = await getDb();
    const updated = await db
      .update(profiles)
      .set({
        habitat: habitat.id,
        materials: profile.materials - habitat.cost,
      })
      .where(eq(profiles.id, profile.id))
      .returning();

    return ok({
      habitat: habitat.id,
      materials: updated[0]?.materials ?? profile.materials - habitat.cost,
    });
  });
}

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets } from "@/lib/db/schema";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { requireSpecies } from "@/lib/game/species";
import { petView } from "@/lib/game/views";

export const runtime = "nodejs";

const schema = z.object({
  nickname: z.string().trim().min(1).max(20).optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]).optional(),
  loadout: z.array(z.number().int()).length(4).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const found = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);

    if (!found[0]) return fail("Pet not found", 404);
    if (found[0].marketListed) return fail("This pet is listed on the market", 400);
    if (found[0].expeditionId) return fail("This pet is on an expedition", 400);

    const { nickname, slot, loadout } = parsed.data;
    if (nickname === undefined && slot === undefined && loadout === undefined) {
      return fail("Nothing to update");
    }

    if (loadout !== undefined) {
      const species = requireSpecies(found[0].speciesId);
      const available = new Set(species.skills.map((entry) => entry.id));
      if (new Set(loadout).size !== 4 || loadout.some((id) => !available.has(id))) {
        return fail("Choose four skills from this pet's kit", 400);
      }
    }

    if (slot !== undefined && slot !== null) {
      await db
        .update(pets)
        .set({ slot: null })
        .where(and(eq(pets.ownerId, profile.id), eq(pets.slot, slot)));
    }

    const updated = await db
      .update(pets)
      .set({
        ...(nickname !== undefined ? { nickname } : {}),
        ...(slot !== undefined ? { slot } : {}),
        ...(loadout !== undefined ? { loadout } : {}),
      })
      .where(eq(pets.id, id))
      .returning();

    await refreshPvpSnapshot(profile);

    return ok({ pet: petView(updated[0]) });
  });
}

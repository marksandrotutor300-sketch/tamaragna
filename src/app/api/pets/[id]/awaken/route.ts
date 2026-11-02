import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets, profiles } from "@/lib/db/schema";
import { awakenCost, MAX_STAR } from "@/lib/game/awakening";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { petView } from "@/lib/game/views";

export const runtime = "nodejs";

const schema = z.object({
  fodderId: z.string().uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.ownerId, profile.id), inArray(pets.id, [id, parsed.data.fodderId])));

    const target = rows.find((pet) => pet.id === id);
    const fodder = rows.find((pet) => pet.id === parsed.data.fodderId);

    if (!target) return fail("Pet not found", 404);
    if (!fodder) return fail("Fodder not found", 404);
    if (target.marketListed || fodder.marketListed) {
      return fail("Cancel market listings before awakening", 400);
    }
    if (target.expeditionId || fodder.expeditionId) {
      return fail("Pets on expeditions cannot be used", 400);
    }
    if (target.id === fodder.id) return fail("Pick a different pet", 400);
    if (target.speciesId !== fodder.speciesId) {
      return fail("Awakening needs a duplicate of the same species", 400);
    }
    if (target.star >= MAX_STAR) return fail(`${target.nickname} is already ${MAX_STAR} stars`, 400);
    if (fodder.slot !== null) return fail("Move the duplicate to storage first", 400);
    if (fodder.star > target.star) {
      return fail("Do not feed a higher-star duplicate to a lower-star pet", 400);
    }

    const cost = awakenCost(target.star);
    if (profile.coins < cost) return fail(`Awakening needs ${cost} coins`, 400);

    const updated = await db.transaction(async (tx) => {
      const [next] = await tx
        .update(pets)
        .set({ star: target.star + 1 })
        .where(eq(pets.id, target.id))
        .returning();

      await tx.delete(pets).where(eq(pets.id, fodder.id));
      await tx
        .update(profiles)
        .set({ coins: profile.coins - cost })
        .where(eq(profiles.id, profile.id));

      return next;
    });

    await refreshPvpSnapshot(profile);

    return ok({
      pet: petView(updated),
      coins: profile.coins - cost,
    });
  });
}

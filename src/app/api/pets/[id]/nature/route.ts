import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets, profiles } from "@/lib/db/schema";
import { NATURE_REROLL_COST, rerollNature, type NatureId } from "@/lib/game/nature";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { petView } from "@/lib/game/views";
import { Rng } from "@/lib/rng";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const db = await getDb();
    const found = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);

    const pet = found[0];
    if (!pet) return fail("Pet not found", 404);
    if (pet.marketListed) return fail("This pet is listed on the market", 400);
    if (pet.expeditionId) return fail("This pet is on an expedition", 400);
    if (profile.coins < NATURE_REROLL_COST) {
      return fail(`Rerolling needs ${NATURE_REROLL_COST} coins`, 400);
    }

    const nature = rerollNature(pet.nature as NatureId, new Rng(crypto.randomUUID()));

    const updated = await db.transaction(async (tx) => {
      const [next] = await tx
        .update(pets)
        .set({ nature })
        .where(eq(pets.id, pet.id))
        .returning();
      await tx
        .update(profiles)
        .set({ coins: profile.coins - NATURE_REROLL_COST })
        .where(eq(profiles.id, profile.id));
      return next;
    });

    await refreshPvpSnapshot(profile);

    return ok({
      pet: petView(updated),
      coins: profile.coins - NATURE_REROLL_COST,
    });
  });
}

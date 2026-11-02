import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { legacyMarks, pets, profiles } from "@/lib/db/schema";
import { legacyTraitFor } from "@/lib/game/legacy";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { getSpecies } from "@/lib/game/species";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:legacy-retire`, LIMITS.legacyRetire))) {
      return fail("Too many retirement actions", 429);
    }
    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);
    const pet = rows[0];
    if (!pet) return fail("Pet not found", 404);
    if (pet.level < 50) return fail("Only level 50 pets can leave a legacy", 400);
    if (pet.marketListed) return fail("Cancel the market listing first", 400);
    if (pet.expeditionId) return fail("This pet is on an expedition", 400);

    const species = getSpecies(pet.speciesId);
    if (!species) return fail("Species data unavailable", 500);
    const trait = legacyTraitFor(species.element);
    const legacyPoints = 5 + Math.floor(pet.star);

    await db.transaction(async (tx) => {
      await tx.insert(legacyMarks).values({
        profileId: profile.id,
        speciesId: pet.speciesId,
        trait,
        sourceName: pet.nickname,
      });
      await tx.delete(pets).where(eq(pets.id, pet.id));
      await tx
        .update(profiles)
        .set({ legacyPoints: profile.legacyPoints + legacyPoints })
        .where(eq(profiles.id, profile.id));
    });

    await refreshPvpSnapshot(profile);
    return ok({ trait, legacyPoints: profile.legacyPoints + legacyPoints });
  });
}

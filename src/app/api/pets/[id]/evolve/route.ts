import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  petSkillMastery,
  pets,
  profiles,
} from "@/lib/db/schema";
import { evolutionOptions } from "@/lib/game/evolution";
import {
  getPetMasteryMap,
  masteryLevelForXp,
} from "@/lib/game/mastery";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { getSpecies } from "@/lib/game/species";
import { defaultLoadout } from "@/lib/game/skills";
import { petView } from "@/lib/game/views";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  toSpeciesId: z.number().int().positive(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:evolve`, LIMITS.evolve))) {
      return fail("Too many evolutions - wait a minute", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);
    const pet = rows[0];
    if (!pet) return fail("Pet not found", 404);
    if (pet.marketListed) return fail("Cancel the market listing first", 400);
    if (pet.expeditionId) return fail("This pet is on an expedition", 400);

    const edge = evolutionOptions(pet.speciesId).find(
      (option) => option.to === parsed.data.toSpeciesId,
    );
    if (!edge) return fail("That evolution is not available", 400);
    if (edge.stage !== pet.evolutionStage + 1) {
      return fail("That evolution requires the previous stage", 400);
    }
    if (pet.level < edge.level) {
      return fail(`Requires level ${edge.level}`, 400);
    }
    if (pet.star < edge.star) {
      return fail(`Requires ${edge.star}★`, 400);
    }
    if (profile.coins < edge.coins) {
      return fail(`Requires ${edge.coins} coins`, 400);
    }

    const target = getSpecies(edge.to);
    if (!target) return fail("Unknown evolution target", 404);
    const loadout = defaultLoadout(target.skills);

    const result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(pets)
        .set({
          speciesId: target.id,
          evolutionStage: edge.stage,
          loadout,
        })
        .where(eq(pets.id, pet.id))
        .returning();

      const freshProfile = await tx
        .update(profiles)
        .set({ coins: profile.coins - edge.coins })
        .where(eq(profiles.id, profile.id))
        .returning();

      const oldMastery = await tx
        .select()
        .from(petSkillMastery)
        .where(eq(petSkillMastery.petId, pet.id));
      await tx.delete(petSkillMastery).where(eq(petSkillMastery.petId, pet.id));

      const targetSkills = new Set(target.skills.map((slot) => slot.id));
      for (const row of oldMastery) {
        if (!targetSkills.has(row.skillId)) continue;
        const xp = Math.floor(row.xp * 0.5);
        await tx.insert(petSkillMastery).values({
          petId: pet.id,
          skillId: row.skillId,
          xp,
          level: masteryLevelForXp(xp),
        });
      }

      return {
        pet: updated[0],
        profile: freshProfile[0] ?? profile,
      };
    });

    await refreshPvpSnapshot(result.profile);
    const mastery = await getPetMasteryMap([result.pet.id]);
    return ok({
      pet: petView(result.pet, mastery[result.pet.id] ?? {}),
      coins: result.profile.coins,
    });
  });
}

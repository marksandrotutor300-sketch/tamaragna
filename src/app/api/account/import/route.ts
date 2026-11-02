import { eq, sql } from "drizzle-orm";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { saveSchema } from "@/lib/account/transfer";
import { getDb } from "@/lib/db/client";
import {
  pets,
  profiles,
  pvpSnapshots,
  questStates,
  seasonRewards,
} from "@/lib/db/schema";
import type { NatureId } from "@/lib/game/nature";
import { NATURE_IDS } from "@/lib/game/nature";
import { getSpecies } from "@/lib/game/species";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:account-import`,
        LIMITS.accountImport,
      ))
    ) {
      return fail("Too many imports - wait a minute", 429);
    }

    const parsed = await parseBody(request, saveSchema);
    if ("error" in parsed) return parsed.error;
    const save = parsed.data;

    const db = await getDb();
    const counts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pets)
      .where(eq(pets.ownerId, profile.id));
    if ((counts[0]?.count ?? 0) > 0) {
      return fail(
        "Import is only for a fresh ranch. Use a transfer code for a full profile.",
        400,
      );
    }

    const slots = new Set<number>();
    for (const pet of save.pets) {
      if (!NATURE_IDS.includes(pet.nature as NatureId)) {
        return fail(`Unknown nature: ${pet.nature}`, 400);
      }

      const species = getSpecies(pet.speciesId);
      if (!species || !species.playable) {
        return fail(`Species ${pet.speciesId} cannot be imported`, 400);
      }

      if (pet.slot !== null) {
        if (slots.has(pet.slot)) {
          return fail("Two pets cannot share a team slot", 400);
        }
        slots.add(pet.slot);
      }

      if (pet.loadout) {
        const available = new Set(species.skills.map((slot) => slot.id));
        if (
          new Set(pet.loadout).size !== 4 ||
          pet.loadout.some((id) => !available.has(id))
        ) {
          return fail(`Invalid skill loadout for ${species.name}`, 400);
        }
      }

      if (Number.isNaN(new Date(pet.care.lastCareAt).getTime())) {
        return fail(`Invalid care timestamp for ${species.name}`, 400);
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({
          displayName: save.profile.displayName,
          coins: save.profile.coins,
          eggs: save.profile.eggs,
          rating: 1000,
          placementMatches: 0,
          season: profile.season,
        })
        .where(eq(profiles.id, profile.id));

      await tx.delete(questStates).where(eq(questStates.profileId, profile.id));
      await tx
        .delete(seasonRewards)
        .where(eq(seasonRewards.profileId, profile.id));
      await tx
        .delete(pvpSnapshots)
        .where(eq(pvpSnapshots.ownerId, profile.id));

      for (const pet of save.pets) {
        await tx.insert(pets).values({
          ownerId: profile.id,
          speciesId: pet.speciesId,
          nickname: pet.nickname,
          rarity: pet.rarity,
          nature: pet.nature,
          star: pet.star,
          level: pet.level,
          exp: pet.exp,
          slot: pet.slot,
          ivs: pet.ivs,
          care: pet.care,
          loadout: pet.loadout ?? null,
        });
      }
    });

    return ok({ imported: save.pets.length });
  });
}

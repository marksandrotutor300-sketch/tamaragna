import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { legacyMarks, pets, profiles } from "@/lib/db/schema";
import { BREED_COST, BREED_MIN_LEVEL, breedChild } from "@/lib/game/breeding";
import { defaultCare } from "@/lib/game/care";
import {
  LEGACY_BREED_COST,
  applyLegacyIvs,
} from "@/lib/game/legacy";
import type { NatureId } from "@/lib/game/nature";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { requireSpecies } from "@/lib/game/species";
import type { Rarity } from "@/lib/game/types";
import { petView } from "@/lib/game/views";
import { Rng } from "@/lib/rng";

export const runtime = "nodejs";

const MAX_PETS = 30;

const schema = z.object({
  parentA: z.string().uuid(),
  parentB: z.string().uuid(),
});

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const { parentA, parentB } = parsed.data;
    if (parentA === parentB) return fail("Pick two different pets", 400);

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.ownerId, profile.id), inArray(pets.id, [parentA, parentB])));

    const a = rows.find((pet) => pet.id === parentA);
    const b = rows.find((pet) => pet.id === parentB);
    if (!a || !b) return fail("Both parents must be yours", 404);
    if (
      a.marketListed ||
      b.marketListed ||
      a.expeditionId ||
      b.expeditionId
    ) {
      return fail("Parents cannot be listed or away on an expedition", 400);
    }

    if (a.level < BREED_MIN_LEVEL || b.level < BREED_MIN_LEVEL) {
      return fail(`Both parents must be level ${BREED_MIN_LEVEL}+`, 400);
    }
    if (profile.eggs < BREED_COST.eggs) {
      return fail(`Breeding needs ${BREED_COST.eggs} eggs`, 400);
    }
    if (profile.coins < BREED_COST.coins) {
      return fail(`Breeding needs ${BREED_COST.coins} coins`, 400);
    }

    const owned = await db.select().from(pets).where(eq(pets.ownerId, profile.id));
    if (owned.length >= MAX_PETS) {
      return fail(`Ranch is full (${MAX_PETS} pets)`, 400);
    }

    const usedSlots = new Set(owned.map((pet) => pet.slot).filter((slot) => slot !== null));
    const freeSlot = [1, 2, 3].find((slot) => !usedSlots.has(slot as 1 | 2 | 3)) ?? null;

    const child = breedChild(
      {
        speciesId: a.speciesId,
        rarity: a.rarity as Rarity,
        ivs: a.ivs,
        nature: a.nature as NatureId,
      },
      {
        speciesId: b.speciesId,
        rarity: b.rarity as Rarity,
        ivs: b.ivs,
        nature: b.nature as NatureId,
      },
      new Rng(crypto.randomUUID()),
    );

    const species = requireSpecies(child.speciesId);

    const useLegacy = profile.legacyPoints >= LEGACY_BREED_COST;
    const mark = useLegacy
      ? (
          await db
            .select()
            .from(legacyMarks)
            .where(eq(legacyMarks.profileId, profile.id))
            .orderBy(desc(legacyMarks.createdAt))
            .limit(1)
        )[0]
      : null;
    const childIvs = useLegacy ? applyLegacyIvs(child.ivs) : child.ivs;

    const inserted = await db
      .insert(pets)
      .values({
        ownerId: profile.id,
        speciesId: child.speciesId,
        nickname: species.name,
        rarity: child.rarity,
        nature: child.nature,
        star: 1,
        level: 1,
        exp: 0,
        slot: freeSlot,
        ivs: childIvs,
        care: defaultCare(),
        parentAId: a.id,
        parentBId: b.id,
        legacyTrait: useLegacy ? mark?.trait ?? "Ancestral Spark" : null,
      })
      .returning();

    const updated = await db
      .update(profiles)
      .set({
        eggs: profile.eggs - BREED_COST.eggs,
        coins: profile.coins - BREED_COST.coins,
        legacyPoints: Math.max(0, profile.legacyPoints - (useLegacy ? LEGACY_BREED_COST : 0)),
      })
      .where(eq(profiles.id, profile.id))
      .returning();

    await refreshPvpSnapshot(profile);

    return ok({
      pet: petView(inserted[0]),
      eggs: updated[0]?.eggs ?? profile.eggs - BREED_COST.eggs,
      coins: updated[0]?.coins ?? profile.coins - BREED_COST.coins,
      legacyApplied: useLegacy,
    });
  });
}

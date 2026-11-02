import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { pets, profiles } from "@/lib/db/schema";
import { defaultCare } from "@/lib/game/care";
import { featuredForDate } from "@/lib/game/featured";
import { EGG_COSTS, rollHatch } from "@/lib/game/hatch";
import { dayKey } from "@/lib/game/quests";
import { recordQuestEventSafe } from "@/lib/game/quest-service";
import type { ElementId } from "@/lib/game/types";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { petView } from "@/lib/game/views";

export const runtime = "nodejs";

const MAX_PETS = 30;

const schema = z.object({
  kind: z.enum(["wild", "focused"]).default("wild"),
  focusElement: z.number().int().min(0).max(9).optional(),
});

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:hatch`, LIMITS.hatch))) {
      return fail("Too many hatches - slow down", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const { kind, focusElement } = parsed.data;
    const cost = EGG_COSTS[kind];

    if (profile.eggs < cost) {
      return fail(`You need ${cost} egg${cost > 1 ? "s" : ""} to hatch this`, 400);
    }

    const db = await getDb();
    const owned = await db.select().from(pets).where(eq(pets.ownerId, profile.id));
    if (owned.length >= MAX_PETS) {
      return fail(`Ranch is full (${MAX_PETS} pets)`, 400);
    }

    const usedSlots = new Set(owned.map((pet) => pet.slot).filter((slot) => slot !== null));
    const freeSlot = [1, 2, 3].find((slot) => !usedSlots.has(slot as 1 | 2 | 3)) ?? null;

    const roll = rollHatch(
      crypto.randomUUID(),
      kind,
      focusElement as ElementId | undefined,
      featuredForDate(dayKey()).map((species) => species.id),
    );

    const inserted = await db
      .insert(pets)
      .values({
        ownerId: profile.id,
        speciesId: roll.species.id,
        nickname: roll.species.name,
        rarity: roll.rarity,
        nature: roll.nature,
        level: 1,
        exp: 0,
        slot: freeSlot,
        ivs: roll.ivs,
        care: defaultCare(),
      })
      .returning();

    const updatedProfile = await db
      .update(profiles)
      .set({ eggs: profile.eggs - cost })
      .where(eq(profiles.id, profile.id))
      .returning();

    await refreshPvpSnapshot(profile);
    await recordQuestEventSafe(profile.id, "hatch", 1);

    return ok({
      pet: petView(inserted[0]),
      eggs: updatedProfile[0]?.eggs ?? profile.eggs - cost,
    });
  });
}

import { and, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets, profiles } from "@/lib/db/schema";
import { petView } from "@/lib/game/views";
import { getPetMasteryMap } from "@/lib/game/mastery";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(eq(pets.ownerId, profile.id))
      .orderBy(asc(pets.createdAt));

    const team = await db
      .select()
      .from(pets)
      .where(and(eq(pets.ownerId, profile.id), isNotNull(pets.slot)))
      .orderBy(asc(pets.slot));

    const fresh = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profile.id))
      .limit(1);

    const current = fresh[0] ?? profile;
    const mastery = await getPetMasteryMap(rows.map((pet) => pet.id));

    return ok({
      profile: {
        id: current.id,
        displayName: current.displayName,
        coins: current.coins,
        eggs: current.eggs,
        food: current.food,
        rating: current.rating,
        season: current.season,
        placementMatches: current.placementMatches,
        publicSlug: current.publicSlug,
        publicCard: current.publicCard,
        materials: current.materials,
        legacyPoints: current.legacyPoints,
        spectatorPoints: current.spectatorPoints,
        habitat: current.habitat,
      },
      pets: rows.map((pet) => petView(pet, mastery[pet.id] ?? {})),
      team: team.map((pet) => pet.id),
    });
  });
}

const renameSchema = z.object({
  displayName: z.string().trim().min(2).max(20),
});

export async function PATCH(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    const parsed = await parseBody(request, renameSchema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const updated = await db
      .update(profiles)
      .set({ displayName: parsed.data.displayName })
      .where(eq(profiles.id, profile.id))
      .returning();

    return ok({ displayName: updated[0]?.displayName ?? parsed.data.displayName });
  });
}

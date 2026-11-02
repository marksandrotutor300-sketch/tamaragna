import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { idempotencyKeys, pets, profiles } from "@/lib/db/schema";
import { applyCareAction, CARE_COSTS, normalizeCare } from "@/lib/game/care";
import { grantExp } from "@/lib/game/leveling";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { recordQuestEventSafe } from "@/lib/game/quest-service";
import { petView } from "@/lib/game/views";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["feed", "play", "rest", "wake", "train"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:care`, LIMITS.care))) {
      return fail("Too many care actions - slow down", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const { action } = parsed.data;
    const idempotencyKey = request.headers.get("idempotency-key");
    const db = await getDb();

    if (idempotencyKey) {
      const existing = await db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.key, idempotencyKey),
            eq(idempotencyKeys.profileId, profile.id),
          ),
        )
        .limit(1);
      if (existing[0]) return ok(existing[0].response);
    }

    const found = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);

    const pet = found[0];
    if (!pet) return fail("Pet not found", 404);
    if (pet.marketListed) return fail("This pet is listed on the market", 400);
    if (pet.expeditionId) return fail("This pet is on an expedition", 400);

    const cost = CARE_COSTS[action];
    if (profile.coins < cost) return fail("Not enough coins", 400);

    const normalized = normalizeCare(pet.care);
    if ((action === "play" || action === "train") && normalized.energy < 10) {
      return fail("Too tired - let them rest first", 400);
    }

    const nextCare = applyCareAction(normalized, action);
    let level = pet.level;
    let exp = pet.exp;

    if (action === "train") {
      const result = grantExp(pet.level, pet.exp, 25);
      level = result.level;
      exp = result.exp;
    }

    const updated = await db
      .update(pets)
      .set({ care: nextCare, level, exp })
      .where(eq(pets.id, pet.id))
      .returning();

    let coins = profile.coins;
    if (cost > 0) {
      const result = await db
        .update(profiles)
        .set({ coins: profile.coins - cost })
        .where(eq(profiles.id, profile.id))
        .returning();
      coins = result[0]?.coins ?? profile.coins - cost;
    }

    if (action === "train") {
      await refreshPvpSnapshot(profile);
    }

    if (action !== "rest" && action !== "wake") {
      await recordQuestEventSafe(profile.id, "care", 1);
    }

    const response = { pet: petView(updated[0]), coins };
    if (idempotencyKey) {
      await db
        .insert(idempotencyKeys)
        .values({
          key: idempotencyKey,
          profileId: profile.id,
          response,
        })
        .onConflictDoNothing();
    }

    return ok(response);
  });
}

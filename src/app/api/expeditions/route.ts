import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { expeditions, pets, profiles } from "@/lib/db/schema";
import { EXPEDITION_ROUTES, expeditionRewards, getExpeditionRoute } from "@/lib/game/expeditions";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const startSchema = z.object({
  routeId: z.string().min(1).max(40),
  petIds: z.array(z.string().uuid()).min(1).max(3),
});

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(expeditions)
      .where(eq(expeditions.profileId, profile.id))
      .orderBy(desc(expeditions.startedAt))
      .limit(12);
    return ok({ routes: EXPEDITION_ROUTES, expeditions: rows });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:expedition-start`,
        LIMITS.expeditionStart,
      ))
    ) {
      return fail("Too many expeditions - wait a few minutes", 429);
    }
    const parsed = await parseBody(request, startSchema);
    if ("error" in parsed) return parsed.error;

    const route = getExpeditionRoute(parsed.data.routeId);
    if (!route) return fail("Unknown expedition route", 404);

    const unique = [...new Set(parsed.data.petIds)];
    if (unique.length !== parsed.data.petIds.length) {
      return fail("Choose each pet once", 400);
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(
        and(
          eq(pets.ownerId, profile.id),
          inArray(pets.id, unique),
        ),
      );
    if (rows.length !== unique.length) return fail("Pet not found", 404);
    if (
      rows.some(
        (pet) =>
          pet.slot !== null ||
          pet.marketListed ||
          pet.expeditionId ||
          pet.level < route.minLevel,
      )
    ) {
      return fail(
        `Use ${unique.length} storage pets at level ${route.minLevel}+ that are neither listed nor away`,
        400,
      );
    }

    const rewards = expeditionRewards(route, rows);
    const endsAt = new Date(Date.now() + route.minutes * 60_000);

    const expedition = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(expeditions)
        .values({
          profileId: profile.id,
          routeId: route.id,
          petIds: unique,
          rewards,
          endsAt,
        })
        .returning();
      for (const pet of rows) {
        await tx
          .update(pets)
          .set({ expeditionId: inserted[0].id })
          .where(eq(pets.id, pet.id));
      }
      return inserted[0];
    });

    return ok({ expedition, route, rewards });
  });
}

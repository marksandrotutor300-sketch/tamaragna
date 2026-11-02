import { and, eq, inArray } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { expeditions, pets, profiles } from "@/lib/db/schema";
import { getExpeditionRoute } from "@/lib/game/expeditions";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(expeditions)
      .where(and(eq(expeditions.id, id), eq(expeditions.profileId, profile.id)))
      .limit(1);
    const expedition = rows[0];
    if (!expedition) return fail("Expedition not found", 404);
    if (expedition.status !== "active") return fail("Already claimed", 409);
    if (expedition.endsAt.getTime() > Date.now()) {
      return fail("The expedition is still travelling", 400);
    }

    const route = getExpeditionRoute(expedition.routeId);
    const result = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(expeditions)
        .set({ status: "claimed", claimedAt: new Date() })
        .where(eq(expeditions.id, expedition.id))
        .returning();
      await tx
        .update(pets)
        .set({ expeditionId: null })
        .where(inArray(pets.id, expedition.petIds));
      const [fresh] = await tx
        .update(profiles)
        .set({
          coins: profile.coins + expedition.rewards.coins,
          eggs: profile.eggs + expedition.rewards.eggs,
          materials: profile.materials + expedition.rewards.materials,
        })
        .where(eq(profiles.id, profile.id))
        .returning();
      return { expedition: claimed, profile: fresh };
    });

    return ok({
      expedition: result.expedition,
      route,
      rewards: expedition.rewards,
      profile: {
        coins: result.profile?.coins ?? profile.coins + expedition.rewards.coins,
        eggs: result.profile?.eggs ?? profile.eggs + expedition.rewards.eggs,
        materials:
          result.profile?.materials ??
          profile.materials + expedition.rewards.materials,
      },
    });
  });
}

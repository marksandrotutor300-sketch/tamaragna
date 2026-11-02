import { eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { SAVE_VERSION } from "@/lib/account/transfer";
import { getDb } from "@/lib/db/client";
import { pets } from "@/lib/db/schema";
import { normalizeCare } from "@/lib/game/care";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:account-export`,
        LIMITS.accountExport,
      ))
    ) {
      return fail("Too many exports - wait a minute", 429);
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(eq(pets.ownerId, profile.id));

    return ok({
      version: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
      profile: {
        displayName: profile.displayName,
        coins: profile.coins,
        eggs: profile.eggs,
        rating: profile.rating,
        season: profile.season,
        placementMatches: profile.placementMatches,
      },
      pets: rows.map((pet) => ({
        speciesId: pet.speciesId,
        nickname: pet.nickname,
        rarity: pet.rarity,
        nature: pet.nature,
        star: pet.star,
        level: pet.level,
        exp: pet.exp,
        slot: pet.slot,
        ivs: pet.ivs,
        care: normalizeCare(pet.care),
        loadout: pet.loadout,
      })),
    });
  });
}

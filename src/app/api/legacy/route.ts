import { and, desc, eq } from "drizzle-orm";
import { ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { legacyMarks, pets } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const marks = await db
      .select()
      .from(legacyMarks)
      .where(eq(legacyMarks.profileId, profile.id))
      .orderBy(desc(legacyMarks.createdAt))
      .limit(30);
    const petRows = await db
      .select()
      .from(pets)
      .where(eq(pets.ownerId, profile.id))
      .orderBy(desc(pets.level));
    const eligible = petRows
      .filter(
        (pet) =>
          pet.level >= 50 &&
          !pet.marketListed &&
          !pet.expeditionId,
      )
      .map((pet) => ({
        id: pet.id,
        nickname: pet.nickname,
        speciesId: pet.speciesId,
        level: pet.level,
        star: pet.star,
      }));
    return ok({
      legacyPoints: profile.legacyPoints,
      marks,
      eligible,
    });
  });
}

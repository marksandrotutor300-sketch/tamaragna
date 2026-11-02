import { and, eq, inArray } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets } from "@/lib/db/schema";
import { getSpecies } from "@/lib/game/species";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const db = await getDb();
    const rootRows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);
    const root = rootRows[0];
    if (!root) return fail("Pet not found", 404);

    const ancestors: Array<{
      id: string;
      nickname: string;
      speciesId: number;
      speciesName: string;
      level: number;
      stage: number;
      parentAId: string | null;
      parentBId: string | null;
      depth: number;
    }> = [];

    let frontier = [root];
    const seen = new Set([root.id]);

    for (let depth = 1; depth <= 4; depth += 1) {
      const parentIds = [
        ...new Set(
          frontier.flatMap((pet) => [pet.parentAId, pet.parentBId]).filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ].filter((parentId) => !seen.has(parentId));
      if (parentIds.length === 0) break;

      const rows = await db
        .select()
        .from(pets)
        .where(
          and(eq(pets.ownerId, profile.id), inArray(pets.id, parentIds)),
        );

      for (const pet of rows) {
        seen.add(pet.id);
        const species = getSpecies(pet.speciesId);
        ancestors.push({
          id: pet.id,
          nickname: pet.nickname,
          speciesId: pet.speciesId,
          speciesName: species?.name ?? "Unknown",
          level: pet.level,
          stage: pet.evolutionStage,
          parentAId: pet.parentAId,
          parentBId: pet.parentBId,
          depth,
        });
      }
      frontier = rows;
    }

    return ok({ ancestors });
  });
}

import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets } from "@/lib/db/schema";
import { evolutionOptions } from "@/lib/game/evolution";
import { getSpecies } from "@/lib/game/species";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, id), eq(pets.ownerId, profile.id)))
      .limit(1);
    const pet = rows[0];
    if (!pet) return fail("Pet not found", 404);

    const options = evolutionOptions(pet.speciesId).flatMap((edge) => {
      const target = getSpecies(edge.to);
      if (!target) return [];
      return [
        {
          ...edge,
          target: {
            id: target.id,
            name: target.name,
            tier: target.tier,
            element: target.element,
            elementLevel: target.elementLevel,
          },
        },
      ];
    });

    return ok({ stage: pet.evolutionStage, options });
  });
}

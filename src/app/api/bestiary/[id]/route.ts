import { fail, ok } from "@/lib/api";
import { getSkill } from "@/lib/game/combat-data";
import { getSpecies } from "@/lib/game/species";
import { skillLevelFor, resolveSkill } from "@/lib/game/skills";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const species = getSpecies(Number(id));
  if (!species) return fail("Species not found", 404);

  const skills = species.skills.flatMap((slot) => {
    const definition = getSkill(slot.id);
    if (!definition) return [];
    return [
      {
        baseLevel: slot.baseLevel,
        definition,
        level1: resolveSkill(definition, 1, species.element),
        level10: resolveSkill(definition, 10, species.element),
        atRarity3: resolveSkill(definition, skillLevelFor(slot.baseLevel, 3), species.element),
      },
    ];
  });

  return ok({ species, skills });
}

import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { buildWildCombatant } from "@/lib/game/combatant";
import { createBattleRow, loadTeamPets } from "@/lib/game/battles";
import { getSpecies } from "@/lib/game/species";
import { teamToCombatants } from "@/lib/game/team";
import { Rng } from "@/lib/rng";

export const runtime = "nodejs";

const schema = z.object({
  speciesId: z.number().int().positive().optional(),
  auto: z.boolean().default(true),
});

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:practice`, LIMITS.practice))) {
      return fail("Too many battles - slow down", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const teamPets = await loadTeamPets(profile.id);
    if (teamPets.length === 0) return fail("Put at least one pet on your team first", 400);

    const teamA = teamToCombatants(teamPets);
    const seed = crypto.randomUUID();
    const rng = new Rng(seed);

    const species = parsed.data.speciesId
      ? getSpecies(parsed.data.speciesId)
      : undefined;
    if (parsed.data.speciesId && !species) return fail("Unknown species", 404);

    const target = species ?? getSpecies(1002)!;
    const level = Math.max(1, ...teamPets.map((pet) => pet.level));

    const teamB = [
      buildWildCombatant({
        petId: "practice-0",
        species: target,
        level,
        rarity: 3,
        rng,
        statMultiplier: 1,
        hpMultiplier: 1,
      }),
    ];

    const payload = {
      teamA,
      teamB,
      ai: { a: parsed.data.auto, b: true },
    };

    const battle = await createBattleRow({
      ownerId: profile.id,
      mode: "practice",
      seed,
      payload,
    });

    return ok({
      battleId: battle.id,
      mode: battle.mode,
      seed,
      payload,
    });
  });
}

import { Rng } from "@/lib/rng";
import { rollIvs } from "./combatant";
import { EGG_COSTS, type EggKind } from "./eggs";
import { NATURE_IDS, type NatureId } from "./nature";
import { hatchWeightsFor, RARITY_IDS } from "./rarity";
import { ALL_SPECIES } from "./species";
import type { ElementId, GeneratedSpecies, Ivs, Rarity } from "./types";

export { EGG_COSTS };
export type { EggKind };

/** Rarer species are less likely to appear in an egg. Index = species tier. */
const SPECIES_WEIGHTS = [0, 50, 25, 14, 8, 3];

export type HatchRoll = {
  species: GeneratedSpecies;
  rarity: Rarity;
  ivs: Ivs;
  nature: NatureId;
};

export function rollHatch(
  seed: string,
  kind: EggKind,
  focusElement?: ElementId,
  featuredIds: number[] = [],
): HatchRoll {
  const rng = new Rng(seed);

  let pool = ALL_SPECIES.filter((species) => species.playable);
  if (kind === "focused" && focusElement !== undefined) {
    const filtered = pool.filter((species) => species.element === focusElement);
    if (filtered.length > 0) pool = filtered;
  }

  const featured = new Set(kind === "wild" ? featuredIds : []);
  const species = rng.weighted(
    pool,
    pool.map(
      (entry) =>
        (SPECIES_WEIGHTS[entry.tier] ?? 1) * (featured.has(entry.id) ? 3 : 1),
    ),
  );

  const rarity = rng.weighted(RARITY_IDS, hatchWeightsFor(species.tier));
  const ivs = rollIvs(rarity, rng);
  const nature = rng.pick(NATURE_IDS);

  return { species, rarity, ivs, nature };
}

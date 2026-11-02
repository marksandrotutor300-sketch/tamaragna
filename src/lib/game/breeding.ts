import type { Rng } from "@/lib/rng";
import { NATURE_IDS, type NatureId } from "./nature";
import type { Ivs, Rarity } from "./types";

export const BREED_MIN_LEVEL = 10;
export const BREED_COST = { eggs: 2, coins: 250 } as const;

export type BreedParent = {
  speciesId: number;
  rarity: Rarity;
  ivs: Ivs;
  nature: NatureId;
};

export type BreedChild = {
  speciesId: number;
  rarity: Rarity;
  ivs: Ivs;
  nature: NatureId;
};

const IV_KEYS = ["str", "agi", "vit", "int", "dex", "luk"] as const;

/**
 * Parent A determines the species line. Each IV is inherited from one parent,
 * with a 12% chance of a +/-3 mutation, so breeding can concentrate good rolls
 * without making wild hatches irrelevant.
 *
 * Rarity: 55% the better parent, 30% one step lower, 15% one step higher.
 */
export function breedChild(parentA: BreedParent, parentB: BreedParent, rng: Rng): BreedChild {
  const best = Math.max(parentA.rarity, parentB.rarity);
  const roll = rng.next();
  const rarity = (
    roll < 0.55
      ? best
      : roll < 0.85
        ? Math.max(1, best - 1)
        : Math.min(5, best + 1)
  ) as Rarity;

  const ivs = {} as Ivs;
  for (const key of IV_KEYS) {
    const inherited = rng.chance(0.5) ? parentA.ivs[key] : parentB.ivs[key];
    const mutation = rng.chance(0.12) ? rng.int(-3, 3) : 0;
    ivs[key] = Math.max(0, Math.min(31, inherited + mutation));
  }

  const natureRoll = rng.next();
  const nature =
    natureRoll < 0.45
      ? parentA.nature
      : natureRoll < 0.9
        ? parentB.nature
        : rng.pick(NATURE_IDS);

  return { speciesId: parentA.speciesId, rarity, ivs, nature };
}

import type { Rng } from "@/lib/rng";

export type NatureId =
  | "hardy"
  | "brave"
  | "bold"
  | "timid"
  | "modest"
  | "calm"
  | "jolly"
  | "adamant";

export type NatureStat = "atk" | "matk" | "def" | "mdef" | "aspdMs";

export type NatureDef = {
  id: NatureId;
  name: string;
  up: NatureStat | null;
  down: NatureStat | null;
  description: string;
};

/**
 * One nature is rolled per pet. It changes two stats by 10% and is inherited
 * through breeding, so two pets of the same species and rarity still differ.
 * `aspdMs` is inverted: a lower value is faster.
 */
export const NATURES: NatureDef[] = [
  { id: "hardy", name: "Hardy", up: null, down: null, description: "No stat changes." },
  {
    id: "brave",
    name: "Brave",
    up: "atk",
    down: "aspdMs",
    description: "+10% ATK, -10% attack speed.",
  },
  {
    id: "bold",
    name: "Bold",
    up: "def",
    down: "atk",
    description: "+10% DEF, -10% ATK.",
  },
  {
    id: "timid",
    name: "Timid",
    up: "aspdMs",
    down: "atk",
    description: "+10% attack speed, -10% ATK.",
  },
  {
    id: "modest",
    name: "Modest",
    up: "matk",
    down: "atk",
    description: "+10% MATK, -10% ATK.",
  },
  {
    id: "calm",
    name: "Calm",
    up: "mdef",
    down: "atk",
    description: "+10% MDEF, -10% ATK.",
  },
  {
    id: "jolly",
    name: "Jolly",
    up: "aspdMs",
    down: "matk",
    description: "+10% attack speed, -10% MATK.",
  },
  {
    id: "adamant",
    name: "Adamant",
    up: "atk",
    down: "matk",
    description: "+10% ATK, -10% MATK.",
  },
];

export const NATURE_IDS: NatureId[] = NATURES.map((nature) => nature.id);

export const NATURE_REROLL_COST = 300;

/** Reroll always lands on a different nature, so the purchase is never wasted. */
export function rerollNature(current: NatureId, rng: Rng): NatureId {
  const options = NATURE_IDS.filter((id) => id !== current);
  return rng.pick(options);
}

export function natureById(id: string | null | undefined): NatureDef {
  return NATURES.find((nature) => nature.id === id) ?? NATURES[0];
}

export type NatureMultipliers = {
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  aspdMs: number;
};

export function natureMultipliers(id: NatureId | null | undefined): NatureMultipliers {
  const nature = natureById(id);
  const multipliers: NatureMultipliers = {
    atk: 1,
    matk: 1,
    def: 1,
    mdef: 1,
    aspdMs: 1,
  };

  if (nature.up) {
    multipliers[nature.up] *= nature.up === "aspdMs" ? 0.9 : 1.1;
  }
  if (nature.down) {
    multipliers[nature.down] *= nature.down === "aspdMs" ? 1.1 : 0.9;
  }

  return multipliers;
}

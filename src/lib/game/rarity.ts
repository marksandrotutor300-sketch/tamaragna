import type { Rarity } from "./types";

export type RarityDef = {
  id: Rarity;
  name: string;
  /** lowest individual value a stat can roll with this rarity */
  ivFloor: number;
  statMult: number;
  /** extra skill levels granted by this rarity */
  skillBonus: number;
  color: string;
  glow: string;
};

export const RARITY: Record<Rarity, RarityDef> = {
  1: {
    id: 1,
    name: "Common",
    ivFloor: 0,
    statMult: 1,
    skillBonus: 0,
    color: "#9aa0a6",
    glow: "rgba(154, 160, 166, 0.35)",
  },
  2: {
    id: 2,
    name: "Uncommon",
    ivFloor: 5,
    statMult: 1.03,
    skillBonus: 1,
    color: "#6ecb63",
    glow: "rgba(110, 203, 99, 0.4)",
  },
  3: {
    id: 3,
    name: "Rare",
    ivFloor: 10,
    statMult: 1.06,
    skillBonus: 2,
    color: "#4aa3ff",
    glow: "rgba(74, 163, 255, 0.45)",
  },
  4: {
    id: 4,
    name: "Epic",
    ivFloor: 16,
    statMult: 1.1,
    skillBonus: 3,
    color: "#b57bff",
    glow: "rgba(181, 123, 255, 0.5)",
  },
  5: {
    id: 5,
    name: "Legendary",
    ivFloor: 22,
    statMult: 1.15,
    skillBonus: 4,
    color: "#ffc94a",
    glow: "rgba(255, 201, 74, 0.55)",
  },
};

export const RARITY_IDS: Rarity[] = [1, 2, 3, 4, 5];

/**
 * Hatch weights per species tier. Species tier biases the roll, but every
 * species can theoretically hatch Legendary - that is the chase moment.
 */
const HATCH_WEIGHTS: Record<Rarity, number[]> = {
  1: [55, 28, 12, 4.5, 0.5],
  2: [40, 30, 19, 9, 2],
  3: [10, 22, 33, 25, 10],
  4: [5, 14, 26, 33, 22],
  5: [0, 0, 10, 30, 60],
};

export function hatchWeightsFor(speciesTier: Rarity): number[] {
  return HATCH_WEIGHTS[speciesTier] ?? HATCH_WEIGHTS[1];
}

export function rarityName(rarity: Rarity): string {
  return RARITY[rarity].name;
}

export function rarityColor(rarity: Rarity): string {
  return RARITY[rarity].color;
}

/** Total individual value score, 0..186. */
export function ivScore(ivs: Record<string, number>): number {
  return Object.values(ivs).reduce((sum, value) => sum + value, 0);
}

/** S/A/B/C grade for a single IV. */
export function ivGrade(value: number): "S" | "A" | "B" | "C" | "D" {
  if (value >= 28) return "S";
  if (value >= 22) return "A";
  if (value >= 15) return "B";
  if (value >= 8) return "C";
  return "D";
}

import type { CardRarity } from "../types";

export type EdictDefinition = {
  id: string;
  name: string;
  description: string;
  cost: number;
  rarity: CardRarity;
};

export const EDICTS: EdictDefinition[] = [
  {
    id: "open-hand",
    name: "Open Hand",
    description: "Draw 1 extra card on the first turn of every card battle.",
    cost: 3,
    rarity: "uncommon",
  },
  {
    id: "iron-heart",
    name: "Iron Heart",
    description: "Champions start every run with 10% more maximum HP.",
    cost: 3,
    rarity: "uncommon",
  },
  {
    id: "relic-seeker",
    name: "Relic Seeker",
    description: "Start every run with a random common relic.",
    cost: 4,
    rarity: "rare",
  },
  {
    id: "second-wind",
    name: "Second Wind",
    description: "Once per run, the first champion to fall is revived at 25% HP.",
    cost: 5,
    rarity: "rare",
  },
  {
    id: "rift-hunger",
    name: "Rift Hunger",
    description: "Battle and treasure rewards offer one extra card.",
    cost: 4,
    rarity: "epic",
  },
];

const BY_ID = new Map(EDICTS.map((edict) => [edict.id, edict]));

export function getEdict(id: string): EdictDefinition | undefined {
  return BY_ID.get(id);
}

export function allEdicts(): EdictDefinition[] {
  return EDICTS;
}

export function hasEdict(edicts: string[] | null | undefined, id: string): boolean {
  return Boolean(edicts?.includes(id));
}

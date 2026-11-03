import type { CardRuneId } from "../types";

export type CardRuneDefinition = {
  id: CardRuneId;
  name: string;
  description: string;
  cost: number;
};

export const CARD_RUNES: CardRuneDefinition[] = [
  {
    id: "ember",
    name: "Ember Rune",
    description: "This card deals 25% more damage.",
    cost: 60,
  },
  {
    id: "bulwark",
    name: "Bulwark Rune",
    description: "This card grants 4 additional block.",
    cost: 60,
  },
  {
    id: "insight",
    name: "Insight Rune",
    description: "Draw 1 card when this card is played.",
    cost: 60,
  },
  {
    id: "leech",
    name: "Leech Rune",
    description: "Heal the owner for 2 when this card deals damage.",
    cost: 60,
  },
  {
    id: "flow",
    name: "Flow Rune",
    description: "Gain 1 energy when this card is played.",
    cost: 60,
  },
];

const BY_ID = new Map(CARD_RUNES.map((rune) => [rune.id, rune]));

export function getRune(id: string | null | undefined): CardRuneDefinition | undefined {
  return id ? BY_ID.get(id as CardRuneId) : undefined;
}

export function allRunes(): CardRuneDefinition[] {
  return CARD_RUNES;
}

import type { CardDefinition } from "../types";

export const ULTIMATE_CARDS: CardDefinition[] = [
  {
    id: "ultimate:verdant",
    name: "Verdant Cataclysm",
    description: "Deal 90% ATK to all enemies and gain 10 block.",
    type: "attack",
    rarity: "epic",
    element: 2,
    cost: 2,
    target: "allEnemies",
    effects: [
      { kind: "damage", power: 90, stat: "atk", target: "allEnemies" },
      { kind: "block", amount: 10, target: "self" },
    ],
  },
  {
    id: "ultimate:ember",
    name: "Ember Nova",
    description: "Deal 160% ATK to one enemy and apply vulnerable 2.",
    type: "attack",
    rarity: "epic",
    element: 3,
    cost: 2,
    target: "enemy",
    effects: [
      { kind: "damage", power: 160, stat: "atk", target: "enemy" },
      { kind: "status", status: "vulnerable", stacks: 2, turns: 2, target: "enemy" },
    ],
  },
  {
    id: "ultimate:veil",
    name: "Veil of Venom",
    description: "Apply poison 4 and weak 2 to all enemies.",
    type: "skill",
    rarity: "epic",
    element: 5,
    cost: 2,
    target: "allEnemies",
    effects: [
      { kind: "status", status: "poison", stacks: 4, turns: 3, target: "allEnemies" },
      { kind: "status", status: "weak", stacks: 2, turns: 2, target: "allEnemies" },
    ],
  },
  {
    id: "ultimate:radiant",
    name: "Radiant Covenant",
    description: "Heal all allies for 15% max HP and grant 8 block.",
    type: "skill",
    rarity: "epic",
    element: 6,
    cost: 2,
    target: "allAllies",
    effects: [
      { kind: "heal", power: 15, basis: "maxHp", target: "allAllies" },
      { kind: "block", amount: 8, target: "allAllies" },
    ],
  },
  {
    id: "ultimate:hollow",
    name: "Hollow Verdict",
    description: "Deal 120% ATK and apply defDown 2 to all enemies.",
    type: "attack",
    rarity: "epic",
    element: 9,
    cost: 2,
    target: "allEnemies",
    effects: [
      { kind: "damage", power: 120, stat: "atk", target: "allEnemies" },
      { kind: "status", status: "defDown", stacks: 2, turns: 2, target: "allEnemies" },
    ],
  },
];

const BY_ID = new Map(ULTIMATE_CARDS.map((card) => [card.id, card]));

export function getUltimate(id: string): CardDefinition | undefined {
  return BY_ID.get(id);
}

export function ultimateForElement(element: number): CardDefinition {
  if (element === 1 || element === 2 || element === 4) return BY_ID.get("ultimate:verdant")!;
  if (element === 3) return BY_ID.get("ultimate:ember")!;
  if (element === 5 || element === 7) return BY_ID.get("ultimate:veil")!;
  if (element === 6 || element === 8) return BY_ID.get("ultimate:radiant")!;
  return BY_ID.get("ultimate:hollow")!;
}

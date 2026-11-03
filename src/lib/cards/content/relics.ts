import type { CardRarity, RelicDefinition } from "../types";

export const RELICS: RelicDefinition[] = [
  {
    id: "moss-cloak",
    name: "Moss Cloak",
    description: "Start each battle with 6 block on every champion.",
    rarity: "common",
    effect: { startBlock: 6 },
  },
  {
    id: "ember-heart",
    name: "Ember Heart",
    description: "Your first attack card each battle deals +4 damage.",
    rarity: "common",
    effect: { firstAttackBonus: 4 },
  },
  {
    id: "wind-chime",
    name: "Wind Chime",
    description: "Draw 1 extra card on the first turn.",
    rarity: "common",
    effect: { startDraw: 1 },
  },
  {
    id: "root-sigil",
    name: "Root Sigil",
    description: "Gain 1 energy on the first turn.",
    rarity: "common",
    effect: { startEnergy: 1 },
  },
  {
    id: "tide-pearl",
    name: "Tide Pearl",
    description: "Water cards deal 15% more damage.",
    rarity: "common",
    effect: { elementBonus: { 1: 0.15 } },
  },
  {
    id: "cinder-bead",
    name: "Cinder Bead",
    description: "Fire cards deal 15% more damage.",
    rarity: "common",
    effect: { elementBonus: { 3: 0.15 } },
  },
  {
    id: "stone-bark",
    name: "Stone Bark",
    description: "Gain 3 block at the start of every turn.",
    rarity: "uncommon",
    effect: { turnBlock: 3 },
  },
  {
    id: "storm-feather",
    name: "Storm Feather",
    description: "Draw 1 extra card at the start of every turn.",
    rarity: "uncommon",
    effect: { drawPerTurn: 1 },
  },
  {
    id: "amber-crown",
    name: "Amber Crown",
    description: "Gain 1 extra energy every turn.",
    rarity: "uncommon",
    effect: { energyPerTurn: 1 },
  },
  {
    id: "venom-gland",
    name: "Venom Gland",
    description: "Poison cards apply +2 poison.",
    rarity: "uncommon",
    effect: { poisonBonus: 2 },
  },
  {
    id: "moon-lens",
    name: "Moon Lens",
    description: "Holy and Dark cards deal 15% more damage.",
    rarity: "uncommon",
    effect: { elementBonus: { 5: 0.15, 6: 0.15 } },
  },
  {
    id: "gale-knot",
    name: "Gale Knot",
    description: "Wind cards deal 15% more damage.",
    rarity: "uncommon",
    effect: { elementBonus: { 4: 0.15 } },
  },
  {
    id: "hearthstone",
    name: "Hearthstone",
    description: "Heal 12 HP after each battle.",
    rarity: "rare",
    effect: { healAfterBattle: 12 },
  },
  {
    id: "golden-acorn",
    name: "Golden Acorn",
    description: "Gain 20% more run gold.",
    rarity: "rare",
    effect: { goldBonus: 0.2 },
  },
  {
    id: "pilgrim-bell",
    name: "Pilgrim Bell",
    description: "Rest sites heal 15% more.",
    rarity: "rare",
    effect: { restHealBonus: 0.15 },
  },
  {
    id: "merchant-seal",
    name: "Merchant Seal",
    description: "Shop prices are 20% lower.",
    rarity: "rare",
    effect: { shopDiscount: 0.2 },
  },
  {
    id: "world-root",
    name: "World Root",
    description: "Start with +15% maximum HP on every champion.",
    rarity: "epic",
    effect: { maxHpBonus: 0.15 },
  },
  {
    id: "astral-prism",
    name: "Astral Prism",
    description: "Gain 8 block and 1 energy at the start of each battle.",
    rarity: "epic",
    effect: { startBlock: 8, startEnergy: 1 },
  },
];

const BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]));
const EVOLVED_CACHE = new Map<string, RelicDefinition>();

function evolveEffect(effect: RelicDefinition["effect"]): RelicDefinition["effect"] {
  return {
    ...effect,
    startBlock: effect.startBlock ? effect.startBlock * 2 : undefined,
    startEnergy: effect.startEnergy ? effect.startEnergy + 1 : undefined,
    startDraw: effect.startDraw ? effect.startDraw + 1 : undefined,
    firstAttackBonus: effect.firstAttackBonus ? effect.firstAttackBonus * 2 : undefined,
    turnBlock: effect.turnBlock ? effect.turnBlock * 2 : undefined,
    drawPerTurn: effect.drawPerTurn ? effect.drawPerTurn + 1 : undefined,
    energyPerTurn: effect.energyPerTurn ? effect.energyPerTurn + 1 : undefined,
    elementBonus: effect.elementBonus
      ? Object.fromEntries(
          Object.entries(effect.elementBonus).map(([element, value]) => [
            element,
            Number(value) * 1.25,
          ]),
        )
      : undefined,
    poisonBonus: effect.poisonBonus ? effect.poisonBonus * 2 : undefined,
    healAfterBattle: effect.healAfterBattle ? effect.healAfterBattle * 2 : undefined,
    shopDiscount: effect.shopDiscount ? effect.shopDiscount + 0.1 : undefined,
    restHealBonus: effect.restHealBonus ? effect.restHealBonus + 0.1 : undefined,
    maxHpBonus: effect.maxHpBonus ? effect.maxHpBonus + 0.1 : undefined,
    goldBonus: effect.goldBonus ? effect.goldBonus + 0.2 : undefined,
  };
}

export function getRelic(id: string): RelicDefinition | undefined {
  if (id.endsWith("+")) {
    const base = BY_ID.get(id.slice(0, -1));
    if (!base) return undefined;
    const cached = EVOLVED_CACHE.get(id);
    if (cached) return cached;
    const evolved: RelicDefinition = {
      ...base,
      id,
      name: `${base.name}+`,
      description: `${base.description} Evolved.`,
      rarity: "epic",
      effect: evolveEffect(base.effect),
    };
    EVOLVED_CACHE.set(id, evolved);
    return evolved;
  }
  return BY_ID.get(id);
}

export function isEvolvedRelic(id: string): boolean {
  return id.endsWith("+");
}

export function evolveRelicId(id: string): string {
  return id.endsWith("+") ? id : `${id}+`;
}

export function allRelics(): RelicDefinition[] {
  return RELICS;
}

export function relicPoolForAct(act: number): RelicDefinition[] {
  const rarity: CardRarity = act === 1 ? "common" : act === 2 ? "uncommon" : "rare";
  return RELICS.filter((relic) => relic.rarity === rarity || relic.rarity === "epic");
}

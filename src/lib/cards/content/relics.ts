import type { CardRarity, RelicDefinition, RelicSetId } from "../types";

export const RELIC_SETS: Record<string, RelicSetId> = {
  "moss-cloak": "verdant",
  "root-sigil": "verdant",
  "stone-bark": "verdant",
  "world-root": "verdant",
  "ember-heart": "ember",
  "cinder-bead": "ember",
  "amber-crown": "ember",
  hearthstone: "ember",
  "wind-chime": "tempest",
  "storm-feather": "tempest",
  "gale-knot": "tempest",
  "tide-pearl": "veil",
  "venom-gland": "veil",
  "moon-lens": "veil",
  "golden-acorn": "wanderer",
  "pilgrim-bell": "wanderer",
  "merchant-seal": "wanderer",
  "astral-prism": "wanderer",
};

const SET_RELICS: RelicDefinition[] = [
  {
    id: "set:verdant-2",
    name: "Verdant Set (2)",
    description: "Start battles with 5 block.",
    rarity: "rare",
    set: "verdant",
    effect: { startBlock: 5 },
  },
  {
    id: "set:verdant-3",
    name: "Verdant Set (3)",
    description: "Gain 2 block at the start of each turn.",
    rarity: "epic",
    set: "verdant",
    effect: { turnBlock: 2 },
  },
  {
    id: "set:ember-2",
    name: "Ember Set (2)",
    description: "Your first attack each battle deals +2 damage.",
    rarity: "rare",
    set: "ember",
    effect: { firstAttackBonus: 2 },
  },
  {
    id: "set:ember-3",
    name: "Ember Set (3)",
    description: "Gain 1 energy on the first turn.",
    rarity: "epic",
    set: "ember",
    effect: { startEnergy: 1 },
  },
  {
    id: "set:tempest-2",
    name: "Tempest Set (2)",
    description: "Draw 1 extra card on the first turn.",
    rarity: "rare",
    set: "tempest",
    effect: { startDraw: 1 },
  },
  {
    id: "set:tempest-3",
    name: "Tempest Set (3)",
    description: "Gain 1 extra energy every turn.",
    rarity: "epic",
    set: "tempest",
    effect: { energyPerTurn: 1 },
  },
  {
    id: "set:veil-2",
    name: "Veil Set (2)",
    description: "Poison cards apply +1 poison.",
    rarity: "rare",
    set: "veil",
    effect: { poisonBonus: 1 },
  },
  {
    id: "set:veil-3",
    name: "Veil Set (3)",
    description: "Poison and Dark cards deal 10% more damage.",
    rarity: "epic",
    set: "veil",
    effect: { elementBonus: { 5: 0.1, 6: 0.1 } },
  },
  {
    id: "set:wanderer-2",
    name: "Wanderer Set (2)",
    description: "Shop prices are 10% lower.",
    rarity: "rare",
    set: "wanderer",
    effect: { shopDiscount: 0.1 },
  },
  {
    id: "set:wanderer-3",
    name: "Wanderer Set (3)",
    description: "Gain 1 extra energy every turn.",
    rarity: "epic",
    set: "wanderer",
    effect: { energyPerTurn: 1 },
  },
];

const SET_BY_ID = new Map(SET_RELICS.map((relic) => [relic.id, relic]));

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
  const setRelic = SET_BY_ID.get(id);
  if (setRelic) return setRelic;
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
      set: RELIC_SETS[base.id],
      effect: evolveEffect(base.effect),
    };
    EVOLVED_CACHE.set(id, evolved);
    return evolved;
  }
  const base = BY_ID.get(id);
  return base ? { ...base, set: RELIC_SETS[base.id] } : undefined;
}

export function isSetRelic(id: string): boolean {
  return id.startsWith("set:");
}

export function syncRelicSets(relics: string[]): string[] {
  const owned = relics.filter((id) => !isSetRelic(id));
  const counts = new Map<RelicSetId, number>();
  for (const id of owned) {
    const baseId = id.endsWith("+") ? id.slice(0, -1) : id;
    const set = RELIC_SETS[baseId];
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  const active: string[] = [];
  for (const [set, count] of counts) {
    if (count >= 2) active.push(`set:${set}-2`);
    if (count >= 3) active.push(`set:${set}-3`);
  }
  return [...owned, ...active];
}

export function relicSetProgress(relics: string[]): Array<{ set: RelicSetId; count: number }> {
  const counts = new Map<RelicSetId, number>();
  for (const id of relics) {
    if (isSetRelic(id)) continue;
    const baseId = id.endsWith("+") ? id.slice(0, -1) : id;
    const set = RELIC_SETS[baseId];
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  return [...counts.entries()].map(([set, count]) => ({ set, count }));
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
